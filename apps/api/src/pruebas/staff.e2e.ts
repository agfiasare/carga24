import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TODOS_LOS_PERMISOS } from '@carga24/shared';
import { generarCodigo } from '../comun/totp.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { agente, CONTRASENA_ADMIN, crearAppDePrueba, ingresarStaff, primerIngresoStaff, type Agente } from './app-de-prueba.js';

const API = '/api/v1';

describe('Staff: ingreso con 2FA, gestión de jugadores, staff y perfiles', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Agente;
  let operador: Agente;
  let operadorId: string;
  let secretoOperador: string;
  let perfiles: Record<string, string>;

  beforeAll(async () => {
    ({ app, prisma } = await crearAppDePrueba());
    perfiles = Object.fromEntries((await prisma.perfil.findMany()).map((p) => [p.nombre, p.id]));
  });
  afterAll(async () => {
    await app.close();
  });

  describe('primer ingreso del admin', () => {
    it('no entra al panel hasta cambiar la contraseña y activar el 2FA', async () => {
      admin = agente(app);
      const ingreso = await admin.post(`${API}/auth/staff/ingreso`).send({ identificador: 'admin', contrasena: CONTRASENA_ADMIN }).expect(200);
      expect(ingreso.body).toEqual({ siguientePaso: 'cambiar_contrasena' });
      expect(ingreso.headers['set-cookie']?.[0]).toMatch(/^c24_staff=/);

      // Con la sesión pendiente no puede usar el panel ni saltear pasos.
      await admin.get(`${API}/auth/staff/yo`).expect(401);
      await admin.get(`${API}/staff`).expect(401);
      await admin.post(`${API}/auth/staff/2fa/configurar`).expect(400);

      await admin.post(`${API}/auth/staff/contrasena-inicial`).send({ nueva: CONTRASENA_ADMIN }).expect(400);
      const cambio = await admin.post(`${API}/auth/staff/contrasena-inicial`).send({ nueva: 'admin-nueva-segura' }).expect(200);
      expect(cambio.body).toEqual({ siguientePaso: 'configurar_2fa' });

      await admin.post(`${API}/auth/staff/2fa/activar`).send({ codigo: '123456' }).expect(400); // falta el QR
      const configuracion = await admin.post(`${API}/auth/staff/2fa/configurar`).expect(200);
      // Pedirlo de nuevo (recarga, doble clic) devuelve el mismo secreto.
      const [otra, otraMas] = await Promise.all([admin.post(`${API}/auth/staff/2fa/configurar`), admin.post(`${API}/auth/staff/2fa/configurar`)]);
      expect([otra.body.secreto, otraMas.body.secreto]).toEqual([configuracion.body.secreto, configuracion.body.secreto]);
      expect(configuracion.body.uri).toMatch(/^otpauth:\/\/totp\/Carga24%3Aadmin\?secret=/);
      await admin.post(`${API}/auth/staff/2fa/activar`).send({ codigo: '000000' }).expect(400);
      const activado = await admin
        .post(`${API}/auth/staff/2fa/activar`)
        .send({ codigo: generarCodigo(configuracion.body.secreto) })
        .expect(200);
      expect(activado.body.permisos).toHaveLength(TODOS_LOS_PERMISOS.length);

      const yo = await admin.get(`${API}/auth/staff/yo`).expect(200);
      expect(yo.body).toMatchObject({ nombreUsuario: 'admin', perfil: { nombre: 'Admin' } });
      const guardado = await prisma.usuario.findUniqueOrThrow({ where: { nombreUsuario: 'admin' } });
      expect(guardado.dosFactoresSecreto).not.toContain(configuracion.body.secreto); // queda cifrado
    });

    it('la cookie de staff no sirve como sesión de jugador', async () => {
      await admin.get(`${API}/yo`).expect(401);
    });
  });

  describe('alta de staff', () => {
    it('el admin crea un operador con perfil y recibe una contraseña temporal', async () => {
      const { body } = await admin
        .post(`${API}/staff`)
        .send({ nombreUsuario: 'laura', nombreVisible: 'Laura', perfilId: perfiles.Operador })
        .expect(201);
      expect(body.contrasenaTemporal).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{4}$/);
      expect(body.staff).toMatchObject({ nombreUsuario: 'laura', tiene2fa: false, debeCambiarContrasena: true });
      expect(body.staff.permisos).toContain('jugadores.crear');
      expect(body.staff.permisos).not.toContain('staff.gestionar');
      operadorId = body.staff.id;

      operador = agente(app);
      secretoOperador = await primerIngresoStaff(operador, 'laura', body.contrasenaTemporal, 'laura-clave-propia');
    });

    it('valida perfil, permisos y nombres repetidos', async () => {
      await admin.post(`${API}/staff`).send({ nombreUsuario: 'laura', nombreVisible: 'Otra', perfilId: perfiles.Operador }).expect(409);
      await admin
        .post(`${API}/staff`)
        .send({ nombreUsuario: 'pedro', nombreVisible: 'Pedro', perfilId: perfiles.Pagos, ajustes: [{ permiso: 'inventado', tipo: 'agregar' }] })
        .expect(400);
    });

    it('el operador no puede gestionar staff ni perfiles', async () => {
      await operador.get(`${API}/staff`).expect(403);
      await operador.get(`${API}/perfiles`).expect(403);
      await operador.post(`${API}/perfiles`).send({ nombre: 'X', permisos: [] }).expect(403);
    });
  });

  describe('jugadores desde el panel', () => {
    let jugadorId: string;
    let temporal: string;

    it('el operador crea un jugador solo con teléfono y le da una contraseña temporal', async () => {
      await operador.post(`${API}/jugadores`).send({ usuarioPlataforma: 'ana99' }).expect(400);
      const { body } = await operador
        .post(`${API}/jugadores`)
        .send({ usuarioPlataforma: 'ana99', telefono: '351 444 5566', notasInternas: 'Viene de referido' })
        .expect(201);
      expect(body.jugador).toMatchObject({ telefono: '5493514445566', nombreUsuario: null, debeCambiarContrasena: true });
      jugadorId = body.jugador.id;
      temporal = body.contrasenaTemporal;
    });

    it('el jugador entra con la temporal y tiene que cambiarla', async () => {
      const jugador = agente(app);
      await jugador.post(`${API}/auth/jugador/ingreso`).send({ identificador: '3514445566', contrasena: temporal }).expect(200);
      const yo = await jugador.get(`${API}/yo`).expect(200);
      expect(yo.body.debeCambiarContrasena).toBe(true);
      await jugador.post(`${API}/yo/contrasena`).send({ actual: temporal, nueva: 'ana-clave-nueva' }).expect(204);
      expect((await jugador.get(`${API}/yo`)).body.debeCambiarContrasena).toBe(false);
    });

    it('busca, ve y edita jugadores', async () => {
      const lista = await operador.get(`${API}/jugadores?buscar=3514445`).expect(200);
      expect(lista.body.total).toBe(1);
      await operador.patch(`${API}/jugadores/${jugadorId}`).send({ nombreUsuario: 'ana' }).expect(200);
      const detalle = await operador.get(`${API}/jugadores/${jugadorId}`).expect(200);
      expect(detalle.body).toMatchObject({ nombreUsuario: 'ana', notasInternas: 'Viene de referido' });
      await operador.patch(`${API}/jugadores/${jugadorId}`).send({ telefono: null, nombreUsuario: null }).expect(400);
      await operador.get(`${API}/jugadores/${operadorId}`).expect(404); // el staff no aparece como jugador
    });

    it('resetear la contraseña cierra las sesiones del jugador', async () => {
      const jugador = agente(app);
      await jugador.post(`${API}/auth/jugador/ingreso`).send({ identificador: 'ana', contrasena: 'ana-clave-nueva' }).expect(200);
      const { body } = await operador.post(`${API}/jugadores/${jugadorId}/resetear-contrasena`).expect(200);
      await jugador.get(`${API}/yo`).expect(401);
      await request(app.getHttpServer()).post(`${API}/auth/jugador/ingreso`).send({ identificador: 'ana', contrasena: body.contrasenaTemporal }).expect(200);
    });

    it('bloquear exige el permiso; con un ajuste individual el operador lo obtiene', async () => {
      await operador.post(`${API}/jugadores/${jugadorId}/bloquear`).expect(403);
      const ajustado = await admin
        .put(`${API}/staff/${operadorId}/ajustes`)
        .send({ ajustes: [{ permiso: 'jugadores.bloquear', tipo: 'agregar' }, { permiso: 'jugadores.editar', tipo: 'quitar' }] })
        .expect(200);
      expect(ajustado.body.permisos).toContain('jugadores.bloquear');
      expect(ajustado.body.permisos).not.toContain('jugadores.editar');

      // Los permisos se recalculan en cada petición: no hace falta volver a ingresar.
      await operador.post(`${API}/jugadores/${jugadorId}/bloquear`).expect(200);
      await operador.patch(`${API}/jugadores/${jugadorId}`).send({ usuarioPlataforma: 'x' }).expect(403);
      const bloqueado = await request(app.getHttpServer()).post(`${API}/auth/jugador/ingreso`).send({ identificador: 'ana', contrasena: 'cualquiera' });
      expect(bloqueado.status).toBe(401); // contraseña mal: no revela el bloqueo
      expect((await prisma.usuario.findUniqueOrThrow({ where: { id: jugadorId } })).estado).toBe('bloqueado');
      await operador.post(`${API}/jugadores/${jugadorId}/desbloquear`).expect(200);
    });
  });

  describe('nadie modifica sus propios permisos', () => {
    let adminId: string;

    beforeAll(async () => {
      adminId = (await admin.get(`${API}/auth/staff/yo`)).body.id;
    });

    it('no puede cambiarse ajustes, perfil ni estado', async () => {
      await admin.put(`${API}/staff/${adminId}/ajustes`).send({ ajustes: [] }).expect(403);
      await admin.patch(`${API}/staff/${adminId}`).send({ perfilId: perfiles.Operador }).expect(403);
      await admin.patch(`${API}/staff/${adminId}`).send({ estado: 'bloqueado' }).expect(403);
      await admin.post(`${API}/staff/${adminId}/resetear-2fa`).expect(403);
      await admin.patch(`${API}/staff/${adminId}`).send({ nombreVisible: 'Admin General' }).expect(200);
    });

    it('no puede editar el perfil que tiene asignado', async () => {
      await admin.put(`${API}/perfiles/${perfiles.Admin}`).send({ nombre: 'Admin', permisos: [] }).expect(403);
    });

    it('siempre queda alguien que puede administrar', async () => {
      // Un supervisor con permiso para editar perfiles intenta sacarle "staff.gestionar" al perfil Admin.
      const alta = await admin
        .post(`${API}/staff`)
        .send({ nombreUsuario: 'sofi', nombreVisible: 'Sofi', perfilId: perfiles.Supervisor, ajustes: [{ permiso: 'perfiles.gestionar', tipo: 'agregar' }] })
        .expect(201);
      const supervisor = agente(app);
      await primerIngresoStaff(supervisor, 'sofi', alta.body.contrasenaTemporal, 'sofi-clave-propia');

      const sinStaff = TODOS_LOS_PERMISOS.filter((p) => p !== 'staff.gestionar');
      const intento = await supervisor.put(`${API}/perfiles/${perfiles.Admin}`).send({ nombre: 'Admin', permisos: sinStaff }).expect(409);
      expect(intento.body.mensaje).toMatch(/nadie podría administrar/);
      const admin2 = await prisma.perfilPermiso.count({ where: { perfilId: perfiles.Admin } });
      expect(admin2).toBe(TODOS_LOS_PERMISOS.length); // no cambió nada
    });
  });

  describe('perfiles', () => {
    it('lista el catálogo de permisos agrupado', async () => {
      const { body } = await admin.get(`${API}/permisos`).expect(200);
      expect(body).toHaveLength(TODOS_LOS_PERMISOS.length);
      expect(body[0]).toEqual({ clave: 'pedidos.ver', grupo: 'Pedidos', descripcion: 'Ver la cola y el historial' });
    });

    it('crea, edita y borra un perfil; no borra uno en uso', async () => {
      const creado = await admin
        .post(`${API}/perfiles`)
        .send({ nombre: 'Cajero', descripcion: 'Solo pagos', permisos: ['pedidos.ver', 'pedidos.pagar', 'pedidos.ver'] })
        .expect(201);
      expect(creado.body).toMatchObject({ nombre: 'Cajero', permisos: ['pedidos.pagar', 'pedidos.ver'], cantidadUsuarios: 0 });
      await admin.post(`${API}/perfiles`).send({ nombre: 'Cajero', permisos: [] }).expect(409);
      await admin.post(`${API}/perfiles`).send({ nombre: 'Raro', permisos: ['no.existe'] }).expect(400);

      const editado = await admin.put(`${API}/perfiles/${creado.body.id}`).send({ nombre: 'Caja', permisos: ['pedidos.ver'] }).expect(200);
      expect(editado.body.permisos).toEqual(['pedidos.ver']);

      await admin.delete(`${API}/perfiles/${perfiles.Operador}`).expect(409);
      await admin.delete(`${API}/perfiles/${creado.body.id}`).expect(204);
    });
  });

  describe('recuperación de acceso del staff', () => {
    it('resetear el 2FA obliga a escanear un QR nuevo y cierra sus sesiones', async () => {
      await admin.post(`${API}/staff/${operadorId}/resetear-2fa`).expect(204);
      await operador.get(`${API}/auth/staff/yo`).expect(401);
      const ingreso = await operador.post(`${API}/auth/staff/ingreso`).send({ identificador: 'laura', contrasena: 'laura-clave-propia' }).expect(200);
      expect(ingreso.body).toEqual({ siguientePaso: 'configurar_2fa' });
      const { body } = await operador.post(`${API}/auth/staff/2fa/configurar`).expect(200);
      await operador.post(`${API}/auth/staff/2fa/activar`).send({ codigo: generarCodigo(body.secreto) }).expect(200);
      secretoOperador = body.secreto;
    });

    it('resetear la contraseña pide elegir una nueva pero mantiene el 2FA', async () => {
      const { body } = await admin.post(`${API}/staff/${operadorId}/resetear-contrasena`).expect(200);
      const cliente = agente(app);
      const ingreso = await cliente.post(`${API}/auth/staff/ingreso`).send({ identificador: 'laura', contrasena: body.contrasenaTemporal }).expect(200);
      expect(ingreso.body).toEqual({ siguientePaso: 'cambiar_contrasena' });
      const cambio = await cliente.post(`${API}/auth/staff/contrasena-inicial`).send({ nueva: 'laura-otra-clave' }).expect(200);
      expect(cambio.body).toEqual({ siguientePaso: 'verificar_2fa' });
      await cliente.post(`${API}/auth/staff/2fa/verificar`).send({ codigo: generarCodigo(secretoOperador) }).expect(200);
      await cliente.get(`${API}/auth/staff/yo`).expect(200);
    });

    it('un staff bloqueado no puede ingresar y pierde sus sesiones', async () => {
      const cliente = agente(app);
      await ingresarStaff(cliente, 'laura', 'laura-otra-clave', secretoOperador);
      await admin.patch(`${API}/staff/${operadorId}`).send({ estado: 'bloqueado' }).expect(200);
      await cliente.get(`${API}/auth/staff/yo`).expect(401);
      await cliente.post(`${API}/auth/staff/ingreso`).send({ identificador: 'laura', contrasena: 'laura-otra-clave' }).expect(403);
    });
  });

  it('todo queda en la auditoría', async () => {
    const acciones = new Set((await prisma.auditoria.findMany({ select: { accion: true } })).map((a) => a.accion));
    for (const accion of ['staff.crear', 'staff.ajustes', 'staff.2fa_activado', 'jugador.crear', 'jugador.bloquear', 'jugador.resetear_contrasena', 'perfil.crear', 'perfil.eliminar']) {
      expect(acciones).toContain(accion);
    }
  });
});
