import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { abrirTurno, agente, CONTRASENA_ADMIN, crearAppDePrueba, primerIngresoStaff, type Agente } from './app-de-prueba.js';

const API = '/api/v1';

describe('Turnos, caja y rendiciones', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Agente;
  let laura: Agente;
  let sofi: Agente;
  let plataformaId: string;
  let jugadorId: string;
  let turnoLaura: string;

  async function alta(usuario: string, perfil: string): Promise<Agente> {
    const perfilId = (await prisma.perfil.findUniqueOrThrow({ where: { nombre: perfil } })).id;
    const { body } = await admin.post(`${API}/staff`).send({ nombreUsuario: usuario, nombreVisible: usuario[0]!.toUpperCase() + usuario.slice(1), perfilId }).expect(201);
    const cliente = agente(app);
    await primerIngresoStaff(cliente, usuario, body.contrasenaTemporal, `${usuario}-clave-propia`);
    return cliente;
  }

  /** Lleva un pedido de punta a punta: tomar, verificar y acreditar o pagar. */
  async function completar(quien: Agente, tipo: 'carga' | 'retiro', monto: number): Promise<number> {
    const { body } = await quien.post(`${API}/pedidos`).send({ tipo, jugadorId, plataformaId, monto, medioPago: 'efectivo' }).expect(201);
    await quien.post(`${API}/pedidos/${body.id}/tomar`).expect(200);
    await quien.post(`${API}/pedidos/${body.id}/verificar`).send({}).expect(200);
    await quien.post(`${API}/pedidos/${body.id}/${tipo === 'carga' ? 'acreditar' : 'pagar'}`).expect(200);
    return body.id as number;
  }

  beforeAll(async () => {
    ({ app, prisma } = await crearAppDePrueba());
    admin = agente(app);
    await primerIngresoStaff(admin, 'admin', CONTRASENA_ADMIN, 'admin-nueva-segura');
    laura = await alta('laura', 'Supervisor');
    sofi = await alta('sofi', 'Operador');
    plataformaId = (await prisma.plataforma.findFirstOrThrow()).id;
    await abrirTurno(admin);
    const { body } = await admin.post(`${API}/jugadores`).send({ usuarioPlataforma: 'ana99', telefono: '11 4444 1234', nombreUsuario: 'ana' }).expect(201);
    jugadorId = body.jugador.id;
  });
  afterAll(async () => {
    await app.close();
  });

  describe('sin turno abierto', () => {
    it('se ve la cola, pero no se registran ni se toman pedidos', async () => {
      await sofi.get(`${API}/pedidos/cola`).expect(200);
      const alta = await sofi.post(`${API}/pedidos`).send({ tipo: 'carga', jugadorId, plataformaId, monto: 1_000_000, medioPago: 'efectivo' }).expect(403);
      expect(alta.body.mensaje).toBe('Iniciá tu turno para operar pedidos');
      const { body: pedido } = await admin.post(`${API}/pedidos`).send({ tipo: 'carga', jugadorId, plataformaId, monto: 500_000, medioPago: 'efectivo' }).expect(201);
      await sofi.post(`${API}/pedidos/${pedido.id}/tomar`).expect(403);
      await admin.post(`${API}/pedidos/${pedido.id}/rechazar`).send({ motivo: 'otro' }).expect(200);
    });

    it('turnos/actual dice que no hay turno y muestra la caja', async () => {
      const { body } = await sofi.get(`${API}/turnos/actual`).expect(200);
      expect(body).toEqual({ turno: null, requiereTurno: true, caja: 0, ultimoCierre: null });
    });
  });

  describe('un turno', () => {
    it('se abre una sola vez', async () => {
      const { body } = await laura.post(`${API}/turnos`).expect(201);
      expect(body.turno).toMatchObject({ usuario: { nombre: 'Laura' }, cajaAlAbrir: 0, ingresos: 0, resultado: 0 });
      turnoLaura = body.turno.id;
      await laura.post(`${API}/turnos`).expect(409);
    });

    it('suma en vivo lo que se acredita y se paga en el turno', async () => {
      await completar(laura, 'carga', 1_000_000); // recargo 5 %: paga 1.050.000
      await completar(laura, 'carga', 2_000_000); // paga 2.100.000
      await completar(laura, 'retiro', 300_000);
      // Lo que acredita otra persona cuenta en su propio turno.
      await completar(admin, 'carga', 400_000);
      const { body } = await laura.get(`${API}/turnos/actual`).expect(200);
      expect(body.turno).toMatchObject({ cantidadCargas: 2, cantidadRetiros: 1, ingresos: 3_150_000, comision: 150_000, cargasNetas: 3_000_000, premios: 300_000, resultado: 2_850_000 });
    });

    it('otra persona no ve ni cierra un turno ajeno sin permiso', async () => {
      await sofi.post(`${API}/turnos`).expect(201);
      await sofi.get(`${API}/turnos/${turnoLaura}`).expect(404);
      await sofi.post(`${API}/turnos/${turnoLaura}/cierre`).send({}).expect(404);
    });

    it('al cerrar libera lo tomado, congela el balance y lo suma a la caja', async () => {
      const { body: tomado } = await laura.post(`${API}/pedidos`).send({ tipo: 'carga', jugadorId, plataformaId, monto: 700_000, medioPago: 'efectivo' }).expect(201);
      await laura.post(`${API}/pedidos/${tomado.id}/tomar`).expect(200);

      const antes = (await laura.get(`${API}/turnos/${turnoLaura}`).expect(200)).body;
      expect(antes).toMatchObject({ cerradoEn: null, tomados: [{ id: tomado.id, tipo: 'carga' }], cajaAntes: 0, cajaAlCerrar: 2_850_000 });

      const { body } = await laura.post(`${API}/turnos/${turnoLaura}/cierre`).send({ saldoInformado: 2_850_000, nota: 'Todo en orden' }).expect(200);
      expect(body).toMatchObject({ resultado: 2_850_000, cajaAlCerrar: 2_850_000, saldoInformado: 2_850_000, nota: 'Todo en orden', cerradoPor: { nombre: 'Laura' }, tomados: [] });
      expect(body.cerradoEn).toBeTruthy();

      const pedido = (await laura.get(`${API}/pedidos/${tomado.id}`).expect(200)).body;
      expect(pedido).toMatchObject({ estado: 'pendiente', tomadoPor: null });
      expect(pedido.eventos.at(-1)).toMatchObject({ nota: 'Liberado al cerrar el turno' });

      await laura.post(`${API}/turnos/${turnoLaura}/cierre`).send({}).expect(409);
      await laura.post(`${API}/pedidos/${tomado.id}/tomar`).expect(403);
      const actual = (await laura.get(`${API}/turnos/actual`).expect(200)).body;
      expect(actual).toMatchObject({ turno: null, caja: 2_850_000, ultimoCierre: { usuario: 'Laura' } });
    });

    it('quien tiene el permiso cierra el turno de otra persona', async () => {
      const turnoSofi = (await sofi.get(`${API}/turnos/actual`).expect(200)).body.turno.id;
      await laura.post(`${API}/turnos/${turnoSofi}/cierre`).send({}).expect(200);
      expect((await sofi.get(`${API}/turnos/actual`).expect(200)).body.turno).toBeNull();
    });
  });

  describe('caja', () => {
    it('la ve quien tiene caja.ver', async () => {
      await sofi.get(`${API}/caja`).expect(403);
      const { body } = await laura.get(`${API}/caja`).expect(200);
      expect(body.saldo).toBe(2_850_000);
      expect(body.turnosSinLiquidar.map((t: { usuario: { nombre: string } }) => t.usuario.nombre)).toEqual(['Laura', 'Sofi']);
      expect(body.turnosAbiertos.map((t: { usuario: { nombre: string }; resultado: number }) => [t.usuario.nombre, t.resultado])).toEqual([['Admin', 420_000]]);
      expect(body.movimientos[0]).toMatchObject({ tipo: 'cierre_turno', monto: 0, saldoPosterior: 2_850_000, turno: { usuario: 'Sofi' } });
      expect(body.gananciaSemana).toBe(170_000);
    });

    it('liquidar pide el permiso y no deja sacar más que el saldo', async () => {
      await laura.post(`${API}/caja/liquidaciones`).send({ monto: 100 }).expect(403);
      const demasiado = await admin.post(`${API}/caja/liquidaciones`).send({ monto: 3_000_000 }).expect(400);
      expect(demasiado.body.mensaje).toContain('No podés liquidar más que el saldo');
      const { body } = await admin.post(`${API}/caja/liquidaciones`).send({ monto: 2_000_000, nota: 'A caja de ahorro' }).expect(201);
      expect(body.saldo).toBe(850_000);
      expect(body.turnosSinLiquidar).toEqual([]);
      expect(body.movimientos[0]).toMatchObject({ tipo: 'liquidacion', monto: -2_000_000, saldoPosterior: 850_000, nota: 'A caja de ahorro', creadoPor: 'Admin' });
    });

    it('los ajustes llevan motivo y pueden ser negativos', async () => {
      await admin.post(`${API}/caja/ajustes`).send({ monto: -50_000 }).expect(400);
      await admin.post(`${API}/caja/ajustes`).send({ monto: 0, nota: 'nada' }).expect(400);
      const { body } = await admin.post(`${API}/caja/ajustes`).send({ monto: -50_000, nota: 'Pedido #12 con monto equivocado' }).expect(201);
      expect(body.saldo).toBe(800_000);
      const auditoria = await prisma.auditoria.findMany({ where: { entidad: 'caja' }, orderBy: { creadoEn: 'asc' } });
      expect(auditoria.map((a) => a.accion)).toEqual(['caja.liquidar', 'caja.ajustar']);
    });
  });

  describe('rendiciones', () => {
    it('lo que corresponde es cargas netas menos premios, y la diferencia pasa a la siguiente', async () => {
      await sofi.get(`${API}/rendiciones`).expect(403);
      const { body } = await admin.get(`${API}/rendiciones`).expect(200);
      expect(body.pendiente).toMatchObject({ desde: null, cargasNetas: 3_400_000, premios: 300_000, comision: 170_000, arrastre: 0, correspondia: 3_100_000 });
      expect(body.historial).toEqual([]);

      const rendida = (await admin.post(`${API}/rendiciones`).send({ monto: 3_000_000, nota: 'Transferencia 123' }).expect(201)).body;
      expect(rendida.historial[0]).toMatchObject({ correspondia: 3_100_000, rendido: 3_000_000, creadoPor: 'Admin' });
      expect(rendida.pendiente).toMatchObject({ cargasNetas: 0, premios: 0, arrastre: 100_000, correspondia: 100_000 });
      expect(rendida.pendiente.desde).toBeTruthy();

      await laura.post(`${API}/rendiciones`).send({ monto: 1 }).expect(403);
    });
  });

  describe('operar sin turno (turnos.opcional)', () => {
    it('quien tiene el permiso opera sin turno y lo que acredita o paga va directo a la caja', async () => {
      const turnoAdmin = (await admin.get(`${API}/turnos/actual`).expect(200)).body.turno.id;
      await admin.post(`${API}/turnos/${turnoAdmin}/cierre`).send({}).expect(200);
      const actual = (await admin.get(`${API}/turnos/actual`).expect(200)).body;
      expect(actual).toMatchObject({ turno: null, requiereTurno: false });
      const saldoAntes = actual.caja;

      const id = await completar(admin, 'carga', 1_000_000); // paga 1.050.000
      const { body } = await admin.get(`${API}/caja`).expect(200);
      expect(body.saldo).toBe(saldoAntes + 1_050_000);
      expect(body.movimientos[0]).toMatchObject({ tipo: 'pedido_sin_turno', monto: 1_050_000, pedidoId: id, nota: `Carga #${id} sin turno`, creadoPor: 'Admin' });
      const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id } });
      expect(pedido.turnoId).toBeNull();
    });
  });
});
