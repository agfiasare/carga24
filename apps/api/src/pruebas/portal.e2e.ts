import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { agente, CONTRASENA_ADMIN, crearAppDePrueba, primerIngresoStaff, type Agente } from './app-de-prueba.js';

const API = '/api/v1';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 2)]);
const CBU = '0000003100012345678901';

describe('Portal del jugador', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ana: Agente;
  let otro: Agente;
  let operador: Agente;
  let supervisor: Agente;
  let cuentaId: string;

  async function registrar(cliente: Agente, nombre: string, telefono: string) {
    await cliente.post(`${API}/auth/jugador/registro`).send({ usuarioPlataforma: `${nombre}_casino`, telefono, nombreUsuario: nombre, contrasena: 'clave-segura-1', mayorDeEdad: true }).expect(201);
  }

  beforeAll(async () => {
    ({ app, prisma } = await crearAppDePrueba());
    const admin = agente(app);
    await primerIngresoStaff(admin, 'admin', CONTRASENA_ADMIN, 'admin-nueva-segura');
    const perfiles = Object.fromEntries((await prisma.perfil.findMany()).map((p) => [p.nombre, p.id]));
    const alta = async (usuario: string, perfil: string) => {
      const { body } = await admin.post(`${API}/staff`).send({ nombreUsuario: usuario, nombreVisible: usuario, perfilId: perfiles[perfil] }).expect(201);
      const cliente = agente(app);
      await primerIngresoStaff(cliente, usuario, body.contrasenaTemporal, `${usuario}-clave-propia`);
      return cliente;
    };
    operador = await alta('laura', 'Operador');
    supervisor = await alta('sofi', 'Supervisor');
    ana = agente(app);
    otro = agente(app);
    await registrar(ana, 'ana', '11 4444 1234');
    await registrar(otro, 'pepe', '11 4444 9999');
    await prisma.configuracion.update({ where: { clave: 'pago.alias' }, data: { valor: 'carga24.pagos' } });
  });
  afterAll(async () => {
    await app.close();
  });

  it('muestra comisión, límites y a dónde transferir', async () => {
    const { body } = await ana.get(`${API}/yo/parametros`).expect(200);
    expect(body).toMatchObject({ comision: { modo: 'recargo', porcentajePb: 500 }, datosPago: { alias: 'carga24.pagos' }, plataforma: { nombre: 'Plataforma principal' } });
  });

  describe('cuentas', () => {
    it('agrega cuentas pendientes, hasta 3 sin verificar', async () => {
      const { body } = await ana.post(`${API}/yo/cuentas`).send({ cbuCvu: '0000-0031 0001 2345 678901', alias: 'Ana.MP' }).expect(201);
      expect(body).toMatchObject({ cbuCvu: CBU, alias: 'ana.mp', estado: 'pendiente' });
      cuentaId = body.id;
      await ana.post(`${API}/yo/cuentas`).send({ cbuCvu: '123' }).expect(400);
      expect((await ana.post(`${API}/yo/cuentas`).send({ cbuCvu: CBU }).expect(409)).body.mensaje).toBe('Esa cuenta ya la tenés cargada');
      expect((await otro.post(`${API}/yo/cuentas`).send({ cbuCvu: CBU }).expect(409)).body.mensaje).toMatch(/otro jugador/);
      await ana.post(`${API}/yo/cuentas`).send({ cbuCvu: '1'.repeat(22) }).expect(201);
      const tercera = await ana.post(`${API}/yo/cuentas`).send({ cbuCvu: '2'.repeat(22) }).expect(201);
      expect((await ana.post(`${API}/yo/cuentas`).send({ cbuCvu: '3'.repeat(22) }).expect(409)).body.mensaje).toMatch(/3 cuentas sin verificar/);
      await ana.delete(`${API}/yo/cuentas/${tercera.body.id}`).expect(204);
      await otro.delete(`${API}/yo/cuentas/${cuentaId}`).expect(404); // no es suya
      expect((await ana.get(`${API}/yo/cuentas`).expect(200)).body).toHaveLength(2);
    });
  });

  describe('pedir una carga', () => {
    let id: number;

    it('exige el comprobante y una cuenta propia', async () => {
      await ana.post(`${API}/yo/pedidos`).field('tipo', 'carga').field('monto', '1000000').field('cuentaId', cuentaId).expect(400);
      const ajena = await otro.post(`${API}/yo/pedidos`).field('tipo', 'carga').field('monto', '1000000').field('cuentaId', cuentaId).attach('archivo', PNG, 'pago.png').expect(400);
      expect(ajena.body.mensaje).toBe('Esa cuenta no es del jugador');
      expect(await prisma.comprobante.count()).toBe(0); // no quedan archivos sueltos
    });

    it('crea el pedido con la comisión y el comprobante, y la cola del staff lo ve', async () => {
      const { body } = await ana.post(`${API}/yo/pedidos`).field('tipo', 'carga').field('monto', '1000000').field('cuentaId', cuentaId).attach('archivo', PNG, 'pago.png').expect(201);
      expect(body).toMatchObject({ tipo: 'carga', canal: 'web', estado: 'pendiente', monto: 1_000_000, montoPagado: 1_050_000, comision: 50_000 });
      expect(body.comprobantes).toHaveLength(1);
      expect(body).not.toHaveProperty('tomadoPor');
      id = body.id;
      const cola = await operador.get(`${API}/pedidos/cola`).expect(200);
      expect(cola.body.find((p: { id: number }) => p.id === id)).toMatchObject({ canal: 'web', jugador: { nombreUsuario: 'ana' } });
    });

    it('no deja tener dos pedidos en curso', async () => {
      const segundo = await ana.post(`${API}/yo/pedidos`).field('tipo', 'carga').field('monto', '1000000').field('cuentaId', cuentaId).attach('archivo', PNG, 'pago.png').expect(409);
      expect(segundo.body.mensaje).toMatch(new RegExp(`pedido en curso \\(#${id}\\)`));
    });

    it('solo el dueño ve el pedido y su comprobante', async () => {
      const pedido = await ana.get(`${API}/yo/pedidos/${id}`).expect(200);
      expect(pedido.body.historial).toEqual([expect.objectContaining({ a: 'pendiente' })]);
      const comprobanteId = pedido.body.comprobantes[0].id;
      const archivo = await ana.get(`${API}/yo/comprobantes/${comprobanteId}`).buffer(true).expect(200);
      expect(Buffer.compare(archivo.body as Buffer, PNG)).toBe(0);
      await otro.get(`${API}/yo/pedidos/${id}`).expect(404);
      await otro.get(`${API}/yo/comprobantes/${comprobanteId}`).expect(404);
      await request(app.getHttpServer()).get(`${API}/yo/pedidos/${id}`).expect(401);
    });

    it('al acreditarse, la cuenta queda verificada y le llega el aviso', async () => {
      await operador.post(`${API}/pedidos/${id}/tomar`).expect(200);
      await operador.post(`${API}/pedidos/${id}/verificar`).send({ referenciaMovimiento: 'OP-1' }).expect(200);
      await supervisor.post(`${API}/pedidos/${id}/acreditar`).expect(200);
      const avisos = await ana.get(`${API}/yo/notificaciones`).expect(200);
      expect(avisos.body.noLeidas).toBe(1);
      expect(avisos.body.avisos[0]).toMatchObject({ titulo: `Tu carga #${id} fue acreditada`, pedidoId: id });
      expect((await ana.post(`${API}/yo/notificaciones/leidas`).send({}).expect(200)).body.noLeidas).toBe(0);
      expect((await ana.get(`${API}/yo/cuentas`)).body.find((c: { id: string }) => c.id === cuentaId).estado).toBe('verificada');
      await ana.delete(`${API}/yo/cuentas/${cuentaId}`).expect(409); // ya se usó
    });
  });

  describe('retiros e historial', () => {
    it('solo a cuentas verificadas; los rechazos avisan con el motivo', async () => {
      const pendiente = (await ana.get(`${API}/yo/cuentas`)).body.find((c: { estado: string }) => c.estado === 'pendiente');
      await ana.post(`${API}/yo/pedidos`).field('tipo', 'retiro').field('monto', '500000').field('cuentaId', pendiente.id).expect(400);
      const { body } = await ana.post(`${API}/yo/pedidos`).field('tipo', 'retiro').field('monto', '500000').field('cuentaId', cuentaId).expect(201);
      expect(body).toMatchObject({ tipo: 'retiro', comprobantes: [] });
      await operador.post(`${API}/pedidos/${body.id}/rechazar`).send({ motivo: 'datos_cuenta', detalle: 'Revisá el CBU' }).expect(200);
      const avisos = (await ana.get(`${API}/yo/notificaciones`)).body;
      expect(avisos.avisos[0]).toMatchObject({ titulo: `Tu retiro #${body.id} fue rechazado`, texto: 'Datos de la cuenta incorrectos: Revisá el CBU' });
    });

    it('filtra el historial', async () => {
      const todos = (await ana.get(`${API}/yo/pedidos`).expect(200)).body;
      expect(todos.total).toBe(2);
      expect((await ana.get(`${API}/yo/pedidos?tipo=retiro`)).body.pedidos.map((p: { tipo: string }) => p.tipo)).toEqual(['retiro']);
      expect((await ana.get(`${API}/yo/pedidos?estado=en_curso`)).body.total).toBe(0);
      expect((await otro.get(`${API}/yo/pedidos`)).body.total).toBe(0);
    });
  });

  describe('novedades', () => {
    it('el staff con permiso publica; el jugador ve solo las publicadas, la fijada primero', async () => {
      await operador.post(`${API}/novedades`).send({ titulo: 'Hola', texto: 'x' }).expect(403);
      const borrador = await supervisor.post(`${API}/novedades`).send({ titulo: 'Borrador', texto: 'Todavía no' }).expect(201);
      await supervisor.post(`${API}/novedades`).send({ titulo: 'Horario de fin de año', texto: 'Atendemos hasta las 20', publicada: true }).expect(201);
      const fijada = await supervisor.post(`${API}/novedades`).send({ titulo: 'Promo de bienvenida', texto: '10% extra', publicada: true, fijada: true }).expect(201);
      let vistas = (await ana.get(`${API}/yo/novedades`).expect(200)).body;
      expect(vistas.map((n: { titulo: string }) => n.titulo)).toEqual(['Promo de bienvenida', 'Horario de fin de año']);

      await supervisor.patch(`${API}/novedades/${borrador.body.id}`).send({ publicada: true, fijada: true }).expect(200);
      vistas = (await ana.get(`${API}/yo/novedades`)).body;
      expect(vistas[0].titulo).toBe('Borrador');
      expect(vistas.filter((n: { fijada: boolean }) => n.fijada)).toHaveLength(1); // una sola fijada
      await supervisor.patch(`${API}/novedades/${fijada.body.id}`).send({ publicada: false }).expect(200);
      await supervisor.delete(`${API}/novedades/${borrador.body.id}`).expect(204);
      expect((await ana.get(`${API}/yo/novedades`)).body.map((n: { titulo: string }) => n.titulo)).toEqual(['Horario de fin de año']);
    });
  });
});
