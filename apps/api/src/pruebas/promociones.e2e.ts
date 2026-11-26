import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fechaArgentina } from '../reportes/fechas.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { abrirTurno, agente, CONTRASENA_ADMIN, crearAppDePrueba, primerIngresoStaff, type Agente } from './app-de-prueba.js';

const API = '/api/v1';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 3)]);
const dia = (offset: number) => fechaArgentina(new Date(Date.now() + offset * 86_400_000));

describe('Promociones', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Agente;
  let pagos: Agente;
  let jugador: Agente;
  let promoId: string;

  beforeAll(async () => {
    ({ app, prisma } = await crearAppDePrueba());
    admin = agente(app);
    await primerIngresoStaff(admin, 'admin', CONTRASENA_ADMIN, 'admin-nueva-segura');
    await abrirTurno(admin);
    const perfilPagos = (await prisma.perfil.findUniqueOrThrow({ where: { nombre: 'Pagos' } })).id;
    const { body } = await admin.post(`${API}/staff`).send({ nombreUsuario: 'caja', nombreVisible: 'Caja', perfilId: perfilPagos }).expect(201);
    pagos = agente(app);
    await primerIngresoStaff(pagos, 'caja', body.contrasenaTemporal, 'caja-clave-propia');
    await abrirTurno(pagos);
    jugador = agente(app);
    await jugador.post(`${API}/auth/jugador/registro`).send({ usuarioPlataforma: 'ana99', telefono: '1144441234', nombreUsuario: 'ana', contrasena: 'clave-segura-1', mayorDeEdad: true }).expect(201);
  });
  afterAll(async () => {
    await app.close();
  });

  it('el staff con permiso crea, programa y pausa promociones', async () => {
    const nueva = await admin
      .post(`${API}/promociones`)
      .send({ titulo: 'Finde 10% extra', condiciones: 'Cargas desde $5.000 de viernes a domingo.', codigo: 'finde10', desde: dia(0), hasta: dia(2), enLanding: true, enInicio: true })
      .expect(201);
    expect(nueva.body).toMatchObject({ codigo: 'FINDE10', activa: true, enNovedades: false });
    promoId = nueva.body.id;
    await admin.post(`${API}/promociones`).send({ titulo: 'Otra', condiciones: 'xxx', codigo: 'FINDE10', desde: dia(0), hasta: dia(1) }).expect(409);
    await admin.post(`${API}/promociones`).send({ titulo: 'Mal', condiciones: 'xxx', codigo: 'MAL1', desde: dia(3), hasta: dia(1) }).expect(400);
    await admin.post(`${API}/promociones`).send({ titulo: 'Más adelante', condiciones: 'Navidad', codigo: 'NAVIDAD', desde: dia(10), hasta: dia(12), enLanding: true }).expect(201);
    await pagos.post(`${API}/promociones`).send({ titulo: 'x', condiciones: 'xxx', codigo: 'XXXX', desde: dia(0), hasta: dia(1) }).expect(403);

    const lista = (await admin.get(`${API}/promociones`).expect(200)).body;
    expect(lista.map((p: { codigo: string; situacion: string }) => [p.codigo, p.situacion])).toEqual([
      ['NAVIDAD', 'programada'],
      ['FINDE10', 'vigente'],
    ]);
  });

  it('la landing (sin sesión) ve solo las vigentes marcadas para ahí', async () => {
    const landing = (await request(app.getHttpServer()).get(`${API}/promociones/vigentes?lugar=landing`).expect(200)).body;
    expect(landing.map((p: { codigo: string }) => p.codigo)).toEqual(['FINDE10']);
    expect(landing[0]).not.toHaveProperty('activa');
    expect((await request(app.getHttpServer()).get(`${API}/promociones/vigentes?lugar=novedades`)).body).toEqual([]);
    await prisma.configuracion.update({ where: { clave: 'atencion.horario' }, data: { valor: 'Todos los días de 10 a 2' } });
    const datos = (await request(app.getHttpServer()).get(`${API}/publico/landing`).expect(200)).body;
    expect(datos).toMatchObject({ horario: 'Todos los días de 10 a 2', whatsapp: '', plataforma: 'Plataforma principal', promo: { codigo: 'FINDE10' } });
  });

  it('el jugador valida el código y lo usa en su carga; el operador lo ve en la cola', async () => {
    expect((await jugador.get(`${API}/promociones/validar/finde10`).expect(200)).body.titulo).toBe('Finde 10% extra');
    expect((await jugador.get(`${API}/promociones/validar/NAVIDAD`).expect(400)).body.mensaje).toMatch(/no está vigente/);
    const cuenta = (await jugador.post(`${API}/yo/cuentas`).send({ cbuCvu: '0000003100012345678901' }).expect(201)).body.id;
    const malo = await jugador.post(`${API}/yo/pedidos`).field('tipo', 'carga').field('monto', '1000000').field('cuentaId', cuenta).field('codigoPromo', 'NOEXISTE').attach('archivo', PNG, 'p.png').expect(400);
    expect(malo.body.mensaje).toMatch(/código de promo/);
    expect(await prisma.comprobante.count()).toBe(0);
    const { body } = await jugador.post(`${API}/yo/pedidos`).field('tipo', 'carga').field('monto', '1000000').field('cuentaId', cuenta).field('codigoPromo', 'finde10').attach('archivo', PNG, 'p.png').expect(201);
    expect(body.promo).toEqual({ codigo: 'FINDE10', titulo: 'Finde 10% extra', condiciones: 'Cargas desde $5.000 de viernes a domingo.' });
    const cola = (await admin.get(`${API}/pedidos/cola`).expect(200)).body;
    expect(cola.find((p: { id: number }) => p.id === body.id).promo.codigo).toBe('FINDE10');
    expect((await admin.get(`${API}/promociones`)).body.find((p: { id: string }) => p.id === promoId).usos).toBe(1);
  });

  it('el staff necesita promos.aplicar para cargar un código, y no va en retiros', async () => {
    const plataformaId = (await prisma.plataforma.findFirstOrThrow()).id;
    const pedido = { tipo: 'carga', telefono: '1155550001', plataformaId, monto: 1_000_000, medioPago: 'efectivo', codigoPromo: 'FINDE10' };
    await pagos.post(`${API}/pedidos`).send(pedido).expect(403); // Pagos no registra pedidos
    expect((await admin.post(`${API}/pedidos`).send(pedido).expect(201)).body.promo.codigo).toBe('FINDE10');
    await admin.post(`${API}/pedidos`).send({ ...pedido, tipo: 'retiro' }).expect(400);
  });

  it('pausada deja de valer; usada no se puede borrar', async () => {
    await admin.patch(`${API}/promociones/${promoId}`).send({ activa: false }).expect(200);
    await jugador.get(`${API}/promociones/validar/FINDE10`).expect(400);
    expect((await admin.delete(`${API}/promociones/${promoId}`).expect(409)).body.mensaje).toMatch(/pausala/);
    const navidad = (await admin.get(`${API}/promociones`)).body.find((p: { codigo: string }) => p.codigo === 'NAVIDAD');
    await admin.patch(`${API}/promociones/${navidad.id}`).send({ hasta: dia(20) }).expect(200);
    await admin.delete(`${API}/promociones/${navidad.id}`).expect(204);
    expect(await prisma.auditoria.count({ where: { accion: { startsWith: 'promo.' } } })).toBe(5);
  });
});
