import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { agente, crearAppDePrueba } from './app-de-prueba.js';

const API = '/api/v1';
const registro = {
  usuarioPlataforma: 'juan_casino',
  telefono: '11 5555-0001',
  nombreUsuario: 'JuanP',
  contrasena: 'clave-segura-1',
  mayorDeEdad: true,
};

describe('Jugador: registro, ingreso y cuenta', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await crearAppDePrueba());
  });
  afterAll(async () => {
    await app.close();
  });

  it('se registra, queda con sesión y ve sus datos; los pedidos previos por WhatsApp pasan a su cuenta', async () => {
    const plataforma = await prisma.plataforma.findFirstOrThrow();
    const previo = await prisma.pedido.create({
      data: { tipo: 'carga', canal: 'manual', telefono: '5491155550001', plataformaId: plataforma.id, monto: 100_000, comisionPb: 500, modoComision: 'recargo' },
    });

    const cliente = agente(app);
    const respuesta = await cliente.post(`${API}/auth/jugador/registro`).send(registro).expect(201);
    expect(respuesta.headers['set-cookie']?.[0]).toMatch(/^c24_jugador=.+HttpOnly; SameSite=Strict/);
    expect(respuesta.body).toMatchObject({ nombreUsuario: 'juanp', telefono: '5491155550001', usuarioPlataforma: 'juan_casino' });
    expect(respuesta.body).not.toHaveProperty('contrasenaHash');

    const yo = await cliente.get(`${API}/yo`).expect(200);
    expect(yo.body.id).toBe(respuesta.body.id);
    expect((await prisma.pedido.findUniqueOrThrow({ where: { id: previo.id } })).jugadorId).toBe(respuesta.body.id);
  });

  it('no deja registrar el mismo teléfono ni nombre de usuario dos veces', async () => {
    const telefono = await request(app.getHttpServer())
      .post(`${API}/auth/jugador/registro`)
      .send({ ...registro, nombreUsuario: 'otro', telefono: '+54 9 11 5555 0001' })
      .expect(409);
    expect(telefono.body.mensaje).toBe('Ese teléfono ya tiene una cuenta');
    const nombre = await request(app.getHttpServer())
      .post(`${API}/auth/jugador/registro`)
      .send({ ...registro, telefono: '11 5555 0002' })
      .expect(409);
    expect(nombre.body.mensaje).toBe('Ese nombre de usuario ya está en uso');
  });

  it('valida los datos del registro', async () => {
    const sinEdad = await request(app.getHttpServer())
      .post(`${API}/auth/jugador/registro`)
      .send({ ...registro, telefono: '11 5555 0003', nombreUsuario: 'nuevo', mayorDeEdad: false })
      .expect(400);
    expect(sinEdad.body.mensaje).toMatch(/mayor de 18/);
    const corta = await request(app.getHttpServer())
      .post(`${API}/auth/jugador/registro`)
      .send({ ...registro, telefono: '11 5555 0003', nombreUsuario: 'nuevo', contrasena: '123' })
      .expect(400);
    expect(corta.body.errores[0].campo).toBe('contrasena');
  });

  it('ingresa con teléfono (en cualquier formato) o con nombre de usuario', async () => {
    for (const identificador of ['011 5555 0001', 'JUANP']) {
      const cliente = agente(app);
      await cliente.post(`${API}/auth/jugador/ingreso`).send({ identificador, contrasena: registro.contrasena }).expect(200);
      await cliente.get(`${API}/yo`).expect(200);
    }
  });

  it('con contraseña incorrecta responde lo mismo exista o no el usuario, y bloquea tras 8 intentos', async () => {
    const mal = await request(app.getHttpServer()).post(`${API}/auth/jugador/ingreso`).send({ identificador: 'juanp', contrasena: 'nop' }).expect(401);
    const inexistente = await request(app.getHttpServer()).post(`${API}/auth/jugador/ingreso`).send({ identificador: 'nadie', contrasena: 'nop' }).expect(401);
    expect(mal.body).toEqual(inexistente.body);

    for (let i = 0; i < 7; i++) {
      await request(app.getHttpServer()).post(`${API}/auth/jugador/ingreso`).send({ identificador: 'nadie', contrasena: 'nop' });
    }
    const bloqueado = await request(app.getHttpServer())
      .post(`${API}/auth/jugador/ingreso`)
      .send({ identificador: 'nadie', contrasena: 'nop' })
      .expect(429);
    expect(bloqueado.body.mensaje).toMatch(/Demasiados intentos/);
  });

  it('cambia la contraseña: pide la actual y cierra las otras sesiones', async () => {
    const celular = agente(app);
    const compu = agente(app);
    for (const cliente of [celular, compu]) {
      await cliente.post(`${API}/auth/jugador/ingreso`).send({ identificador: 'juanp', contrasena: registro.contrasena }).expect(200);
    }
    await celular.post(`${API}/yo/contrasena`).send({ actual: 'otra-cosa', nueva: 'clave-nueva-22' }).expect(400);
    await celular.post(`${API}/yo/contrasena`).send({ actual: registro.contrasena, nueva: 'clave-nueva-22' }).expect(204);

    await celular.get(`${API}/yo`).expect(200);
    await compu.get(`${API}/yo`).expect(401);
    await request(app.getHttpServer()).post(`${API}/auth/jugador/ingreso`).send({ identificador: 'juanp', contrasena: registro.contrasena }).expect(401);
    await request(app.getHttpServer()).post(`${API}/auth/jugador/ingreso`).send({ identificador: 'juanp', contrasena: 'clave-nueva-22' }).expect(200);
  });

  it('al salir, la sesión deja de valer', async () => {
    const cliente = agente(app);
    await cliente.post(`${API}/auth/jugador/ingreso`).send({ identificador: 'juanp', contrasena: 'clave-nueva-22' }).expect(200);
    await cliente.post(`${API}/auth/jugador/salir`).expect(204);
    await cliente.get(`${API}/yo`).expect(401);
  });

  it('un jugador no entra a rutas del panel', async () => {
    const cliente = agente(app);
    await cliente.post(`${API}/auth/jugador/ingreso`).send({ identificador: 'juanp', contrasena: 'clave-nueva-22' }).expect(200);
    await cliente.get(`${API}/jugadores`).expect(401);
    await cliente.get(`${API}/auth/staff/yo`).expect(401);
  });

  it('rechaza peticiones que cambian datos desde otro sitio', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`${API}/auth/jugador/ingreso`)
      .set('Origin', 'https://sitio-malicioso.com')
      .send({ identificador: 'juanp', contrasena: 'clave-nueva-22' })
      .expect(403);
    expect(respuesta.body.mensaje).toBe('Origen no permitido');
  });

  it('la ruta de salud sigue siendo pública', async () => {
    const salud = await request(app.getHttpServer()).get(`${API}/salud`).expect(200);
    expect(salud.body.baseDeDatos).toBe('ok');
  });
});
