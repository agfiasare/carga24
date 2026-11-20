import type { INestApplication } from '@nestjs/common';
import { request as http } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generarCodigo } from '../comun/totp.js';
import { EventosPedidos, type EventoCola } from '../pedidos/eventos.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { agente, CONTRASENA_ADMIN, crearAppDePrueba, primerIngresoStaff, type Agente } from './app-de-prueba.js';

const API = '/api/v1';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

describe('Pedidos: alta manual, cola y cambios de estado', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const staff: Record<string, Agente> = {};
  const secretos: Record<string, string> = {};
  let plataformaId: string;
  let jugadorId: string;
  let cuentaId: string;
  const eventos: EventoCola[] = [];

  async function alta(admin: Agente, usuario: string, perfil: string, perfiles: Record<string, string>) {
    const { body } = await admin.post(`${API}/staff`).send({ nombreUsuario: usuario, nombreVisible: usuario[0]!.toUpperCase() + usuario.slice(1), perfilId: perfiles[perfil] }).expect(201);
    staff[usuario] = agente(app);
    secretos[usuario] = await primerIngresoStaff(staff[usuario]!, usuario, body.contrasenaTemporal, `${usuario}-clave-propia`);
  }

  const nuevaCarga = (extra: object = {}) => ({ tipo: 'carga', jugadorId, plataformaId, monto: 1_000_000, medioPago: 'otra_cuenta', ...extra });

  beforeAll(async () => {
    ({ app, prisma } = await crearAppDePrueba());
    app.get(EventosPedidos).flujo().subscribe((e) => eventos.push(e));
    const perfiles = Object.fromEntries((await prisma.perfil.findMany()).map((p) => [p.nombre, p.id]));
    staff.admin = agente(app);
    await primerIngresoStaff(staff.admin, 'admin', CONTRASENA_ADMIN, 'admin-nueva-segura');
    await alta(staff.admin, 'laura', 'Operador', perfiles);
    await alta(staff.admin, 'pablo', 'Operador', perfiles);
    await alta(staff.admin, 'caja', 'Pagos', perfiles);
    await alta(staff.admin, 'sofi', 'Supervisor', perfiles);
    plataformaId = (await prisma.plataforma.findFirstOrThrow()).id;
    const { body } = await staff.laura!.post(`${API}/jugadores`).send({ usuarioPlataforma: 'ana99', telefono: '11 4444 1234', nombreUsuario: 'ana' }).expect(201);
    jugadorId = body.jugador.id;
    // Las cuentas las carga el jugador desde la web (Sprint 3); acá se crea directo.
    cuentaId = (await prisma.cuentaBancaria.create({ data: { usuarioId: jugadorId, cbuCvu: '0000003100012345678901', alias: 'ana.mp', estado: 'pendiente' } })).id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('lista las cuentas del jugador para elegir origen o destino', async () => {
    const { body } = await staff.laura!.get(`${API}/jugadores/${jugadorId}/cuentas`).expect(200);
    expect(body).toEqual([expect.objectContaining({ id: cuentaId, alias: 'ana.mp', estado: 'pendiente' })]);
  });

  it('da los parámetros para el formulario', async () => {
    const { body } = await staff.laura!.get(`${API}/pedidos/parametros`).expect(200);
    expect(body).toMatchObject({ comision: { modo: 'recargo', porcentajePb: 500 }, montos: { cargaMinima: 100_000 } });
    expect(body.plataformas).toEqual([{ id: plataformaId, nombre: 'Plataforma principal' }]);
  });

  describe('alta manual', () => {
    it('registra una carga con la comisión calculada y avisa a la cola', async () => {
      const { body } = await staff.laura!.post(`${API}/pedidos`).send(nuevaCarga({ medioPago: 'cuenta_registrada', cuentaId })).expect(201);
      expect(body).toMatchObject({ tipo: 'carga', estado: 'pendiente', canal: 'manual', monto: 1_000_000, montoPagado: 1_050_000, ganancia: 50_000, comisionPb: 500 });
      expect(body.jugador.nombreUsuario).toBe('ana');
      expect(body.eventos).toHaveLength(1);
      expect(eventos.at(-1)).toMatchObject({ tipo: 'pedido.creado', pedidoId: body.id });
    });

    it('con un teléfono sin cuenta deja el pedido a ese número; con uno con cuenta lo asocia', async () => {
      const nuevo = await staff.laura!.post(`${API}/pedidos`).send({ ...nuevaCarga(), jugadorId: undefined, telefono: '11 9999 0000', medioPago: 'efectivo' }).expect(201);
      expect(nuevo.body).toMatchObject({ jugador: null, telefono: '5491199990000' });
      const conocido = await staff.laura!.post(`${API}/pedidos`).send({ ...nuevaCarga(), jugadorId: undefined, telefono: '011 4444-1234' }).expect(201);
      expect(conocido.body.jugador.id).toBe(jugadorId);
    });

    it('respeta los límites y las reglas de las cuentas', async () => {
      const chica = await staff.laura!.post(`${API}/pedidos`).send(nuevaCarga({ monto: 50_000 })).expect(400);
      expect(chica.body.mensaje).toMatch(/de \$\s?1\.000 a/);
      await staff.laura!.post(`${API}/pedidos`).send({ ...nuevaCarga(), tipo: 'retiro', medioPago: 'otra_cuenta' }).expect(400);
      const pendiente = await staff.laura!.post(`${API}/pedidos`).send({ ...nuevaCarga(), tipo: 'retiro', medioPago: 'cuenta_registrada', cuentaId }).expect(400);
      expect(pendiente.body.mensaje).toBe('Los retiros van solo a cuentas verificadas');
      await staff.caja!.post(`${API}/pedidos`).send(nuevaCarga()).expect(403); // el perfil Pagos no registra pedidos
    });
  });

  describe('tomar y liberar', () => {
    let id: number;
    beforeAll(async () => {
      id = (await staff.laura!.post(`${API}/pedidos`).send(nuevaCarga()).expect(201)).body.id;
    });

    it('si dos lo toman a la vez, solo uno lo consigue', async () => {
      const [a, b] = await Promise.all([staff.laura!.post(`${API}/pedidos/${id}/tomar`), staff.pablo!.post(`${API}/pedidos/${id}/tomar`)]);
      const estados = [a.status, b.status].sort();
      expect(estados).toEqual([200, 409]);
      const perdedor = a.status === 409 ? a : b;
      const ganador = a.status === 200 ? 'Laura' : 'Pablo';
      expect(perdedor.body.mensaje).toBe(`El pedido #${id} ya lo tomó ${ganador}`);
      if (ganador === 'Pablo') await staff.pablo!.post(`${API}/pedidos/${id}/liberar`).expect(200);
      else await staff.laura!.post(`${API}/pedidos/${id}/liberar`).expect(200);
    });

    it('solo quien lo tomó puede liberarlo o verificarlo', async () => {
      await staff.laura!.post(`${API}/pedidos/${id}/tomar`).expect(200);
      const ajeno = await staff.pablo!.post(`${API}/pedidos/${id}/liberar`).expect(403);
      expect(ajeno.body.mensaje).toMatch(/Lo tomó Laura/);
      await staff.pablo!.post(`${API}/pedidos/${id}/verificar`).send({ referenciaMovimiento: 'X1' }).expect(403);
      const liberado = await staff.laura!.post(`${API}/pedidos/${id}/liberar`).expect(200);
      expect(liberado.body).toMatchObject({ estado: 'pendiente', tomadoPor: null });
    });
  });

  describe('carga: verificar y acreditar', () => {
    let id: number;
    beforeAll(async () => {
      id = (await staff.laura!.post(`${API}/pedidos`).send(nuevaCarga({ medioPago: 'cuenta_registrada', cuentaId })).expect(201)).body.id;
      await staff.laura!.post(`${API}/pedidos/${id}/tomar`).expect(200);
    });

    it('pide el número de operación, y el pago verifica la cuenta pendiente', async () => {
      await staff.laura!.post(`${API}/pedidos/${id}/verificar`).send({}).expect(400);
      const { body } = await staff.laura!.post(`${API}/pedidos/${id}/verificar`).send({ referenciaMovimiento: 'OP-778899' }).expect(200);
      expect(body).toMatchObject({ estado: 'verificado', referenciaMovimiento: 'OP-778899', verificadoPor: { nombre: 'Laura' } });
      expect(body.cuenta.estado).toBe('verificada');
      expect(body.eventos.at(-1).nota).toMatch(/Cuenta verificada con este pago/);
    });

    it('un número de operación no se puede usar dos veces', async () => {
      const otro = (await staff.laura!.post(`${API}/pedidos`).send(nuevaCarga()).expect(201)).body.id;
      await staff.laura!.post(`${API}/pedidos/${otro}/tomar`).expect(200);
      const repetido = await staff.laura!.post(`${API}/pedidos/${otro}/verificar`).send({ referenciaMovimiento: 'OP-778899' }).expect(409);
      expect(repetido.body.mensaje).toBe(`Ese número de operación ya se usó en el pedido #${id}`);
    });

    it('acredita solo quien tiene el permiso, y queda en "cerrados hoy"', async () => {
      await staff.laura!.post(`${API}/pedidos/${id}/acreditar`).expect(403);
      const { body } = await staff.caja!.post(`${API}/pedidos/${id}/acreditar`).expect(200);
      expect(body).toMatchObject({ estado: 'acreditado', ejecutadoPor: { nombre: 'Caja' } });
      expect(body.eventos.map((e: { a: string }) => e.a)).toEqual(['pendiente', 'en_proceso', 'verificado', 'acreditado']);
      const cola = await staff.laura!.get(`${API}/pedidos/cola`).expect(200);
      expect(cola.body.find((p: { id: number }) => p.id === id).estado).toBe('acreditado');
      await staff.caja!.post(`${API}/pedidos/${id}/acreditar`).expect(409);
    });
  });

  describe('retiros', () => {
    it('se pagan con el comprobante de la transferencia', async () => {
      const { body } = await staff.laura!.post(`${API}/pedidos`).send({ ...nuevaCarga(), tipo: 'retiro', monto: 5_000_000, medioPago: 'cuenta_registrada', cuentaId }).expect(201);
      expect(body).toMatchObject({ ganancia: 0, montoPagado: null, requiereAprobacion: false });
      await staff.laura!.post(`${API}/pedidos/${body.id}/tomar`).expect(200);
      expect((await staff.laura!.post(`${API}/pedidos/${body.id}/verificar`).send({}).expect(200)).body.estado).toBe('verificado');
      const sinComprobante = await staff.caja!.post(`${API}/pedidos/${body.id}/pagar`).expect(400);
      expect(sinComprobante.body.mensaje).toMatch(/Adjuntá el comprobante/);
      await staff.caja!.post(`${API}/pedidos/${body.id}/comprobantes`).field('tipo', 'retiro').attach('archivo', PNG, 'transferencia.png').expect(201);
      expect((await staff.caja!.post(`${API}/pedidos/${body.id}/pagar`).expect(200)).body.estado).toBe('pagado');
    });

    it('los grandes esperan la aprobación de un supervisor', async () => {
      const { body } = await staff.laura!.post(`${API}/pedidos`).send({ ...nuevaCarga(), tipo: 'retiro', monto: 20_000_000, medioPago: 'cuenta_registrada', cuentaId }).expect(201);
      expect(body.requiereAprobacion).toBe(true);
      await staff.laura!.post(`${API}/pedidos/${body.id}/tomar`).expect(200);
      expect((await staff.laura!.post(`${API}/pedidos/${body.id}/verificar`).send({}).expect(200)).body.estado).toBe('espera_aprobacion');
      await staff.laura!.post(`${API}/pedidos/${body.id}/aprobar`).expect(403);
      expect((await staff.sofi!.post(`${API}/pedidos/${body.id}/aprobar`).expect(200)).body.estado).toBe('verificado');
    });
  });

  describe('rechazos', () => {
    it('pide motivo, el jugador lo ve y es final', async () => {
      const { body } = await staff.laura!.post(`${API}/pedidos`).send(nuevaCarga()).expect(201);
      await staff.laura!.post(`${API}/pedidos/${body.id}/rechazar`).send({}).expect(400);
      const rechazado = await staff.laura!.post(`${API}/pedidos/${body.id}/rechazar`).send({ motivo: 'no_llego', detalle: 'Esperamos 2 horas' }).expect(200);
      expect(rechazado.body).toMatchObject({ estado: 'rechazado', motivoRechazo: 'El pago no llegó: Esperamos 2 horas' });
      await staff.laura!.post(`${API}/pedidos/${body.id}/tomar`).expect(409);
      await staff.laura!.post(`${API}/pedidos/${body.id}/comprobantes`).attach('archivo', PNG, 'x.png').expect(409);
    });

    it('en proceso, solo lo rechaza quien lo tomó', async () => {
      const { body } = await staff.laura!.post(`${API}/pedidos`).send(nuevaCarga()).expect(201);
      await staff.laura!.post(`${API}/pedidos/${body.id}/tomar`).expect(200);
      await staff.pablo!.post(`${API}/pedidos/${body.id}/rechazar`).send({ motivo: 'otro' }).expect(403);
      await staff.laura!.post(`${API}/pedidos/${body.id}/rechazar`).send({ motivo: 'monto_no_coincide' }).expect(200);
    });
  });

  describe('comprobantes', () => {
    let id: number;
    beforeAll(async () => {
      id = (await staff.laura!.post(`${API}/pedidos`).send(nuevaCarga()).expect(201)).body.id;
    });

    it('acepta fotos y PDF, y solo el staff los ve', async () => {
      const { body } = await staff.laura!.post(`${API}/pedidos/${id}/comprobantes`).attach('archivo', PNG, 'pago.png').expect(201);
      expect(body).toMatchObject({ tipo: 'pago', mime: 'image/png', tamanoBytes: PNG.length });
      const archivo = await staff.pablo!.get(`${API}/comprobantes/${body.id}`).buffer(true).expect(200);
      expect(archivo.headers['content-type']).toBe('image/png');
      expect(archivo.headers['x-content-type-options']).toBe('nosniff');
      expect(Buffer.compare(archivo.body as Buffer, PNG)).toBe(0);
      await request(app.getHttpServer()).get(`${API}/comprobantes/${body.id}`).expect(401);
    });

    it('rechaza otros tipos de archivo y los de más de 10 MB', async () => {
      const html = await staff.laura!.post(`${API}/pedidos/${id}/comprobantes`).attach('archivo', Buffer.from('<html><script>x</script>'), 'pago.jpg').expect(400);
      expect(html.body.mensaje).toMatch(/foto .* o un PDF/);
      const grande = await staff.laura!.post(`${API}/pedidos/${id}/comprobantes`).attach('archivo', Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]), 'g.png').expect(413);
      expect(grande.body.mensaje).toBe('El archivo supera los 10 MB');
      await staff.laura!.post(`${API}/pedidos/${id}/comprobantes`).expect(400);
    });
  });

  it('la cola en vivo avisa por Server-Sent Events', async () => {
    // Cookie de una sesión completa de Pablo, para abrir el flujo con un cliente HTTP común.
    const ingreso = await request(app.getHttpServer()).post(`${API}/auth/staff/ingreso`).send({ identificador: 'pablo', contrasena: 'pablo-clave-propia' }).expect(200);
    const pendiente = ingreso.headers['set-cookie']![0]!.split(';')[0]!;
    const completa = await request(app.getHttpServer()).post(`${API}/auth/staff/2fa/verificar`).set('Cookie', pendiente).send({ codigo: generarCodigo(secretos.pablo!) }).expect(200);
    const cookie = (completa.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('c24_staff=') && !c.startsWith('c24_staff=;'))!.split(';')[0]!;

    const servidor = app.getHttpServer();
    if (!servidor.listening) await new Promise<void>((r) => servidor.listen(0, r));
    const { port } = servidor.address() as AddressInfo;
    const recibido = new Promise<string>((resolve, reject) => {
      const req = http({ host: '127.0.0.1', port, path: `${API}/pedidos/eventos`, headers: { Cookie: cookie, Accept: 'text/event-stream' } }, (res) => {
        expect(res.headers['content-type']).toMatch(/text\/event-stream/);
        let texto = '';
        res.on('data', (parte: Buffer) => {
          texto += parte.toString();
          if (texto.includes('event: pedido.creado')) {
            req.destroy();
            resolve(texto);
          }
        });
        // Con la conexión abierta, se registra un pedido.
        staff.laura!.post(`${API}/pedidos`).send(nuevaCarga()).then(() => undefined, reject);
      });
      req.on('error', reject);
      req.end();
      setTimeout(() => {
        req.destroy();
        reject(new Error('No llegó el evento'));
      }, 10_000);
    });
    const texto = await recibido;
    expect(texto).toMatch(/data: \{"tipo":"pedido.creado","pedidoId":\d+,"estado":"pendiente"/);
  });
});
