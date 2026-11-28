import type { INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fechaArgentina } from '../reportes/fechas.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { abrirTurno, agente, CONTRASENA_ADMIN, crearAppDePrueba, primerIngresoStaff, type Agente } from './app-de-prueba.js';

const API = '/api/v1';

describe('Configuración, auditoría, reportes y exportación', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Agente;
  let laura: Agente;
  let lauraId: string;
  let plataformaId: string;
  const hoy = fechaArgentina(new Date());

  beforeAll(async () => {
    ({ app, prisma } = await crearAppDePrueba());
    admin = agente(app);
    await primerIngresoStaff(admin, 'admin', CONTRASENA_ADMIN, 'admin-nueva-segura');
    await abrirTurno(admin);
    const operador = (await prisma.perfil.findUniqueOrThrow({ where: { nombre: 'Operador' } })).id;
    const { body } = await admin.post(`${API}/staff`).send({ nombreUsuario: 'laura', nombreVisible: 'Laura', perfilId: operador }).expect(201);
    lauraId = body.staff.id;
    laura = agente(app);
    await primerIngresoStaff(laura, 'laura', body.contrasenaTemporal, 'laura-clave-propia');
    await abrirTurno(laura);
    plataformaId = (await prisma.plataforma.findFirstOrThrow()).id;
  });
  afterAll(async () => {
    await app.close();
  });

  describe('configuración', () => {
    it('se lee y se cambia solo lo enviado; queda en la auditoría con antes y después', async () => {
      const antes = (await admin.get(`${API}/configuracion`).expect(200)).body;
      expect(antes).toMatchObject({ comision: { modo: 'recargo', porcentajePb: 500 }, montos: { cargaMinima: 100_000 }, cuentasPendientesMaximas: 3 });
      const { body } = await admin.put(`${API}/configuracion`).send({ comision: { porcentajePb: 700 }, pago: { alias: 'carga24.pagos' } }).expect(200);
      expect(body).toMatchObject({ comision: { modo: 'recargo', porcentajePb: 700 }, pago: { alias: 'carga24.pagos' } });
      const registro = await prisma.auditoria.findFirstOrThrow({ where: { accion: 'configuracion.editar' } });
      expect(registro.datos).toEqual({
        cambios: [
          { clave: 'comision.porcentaje_pb', anterior: 500, nuevo: 700 },
          { clave: 'pago.alias', anterior: '', nuevo: 'carga24.pagos' },
        ],
      });
    });

    it('valida los valores y exige el permiso', async () => {
      await admin.put(`${API}/configuracion`).send({ comision: { porcentajePb: 9000 } }).expect(400);
      const cruzado = await admin.put(`${API}/configuracion`).send({ montos: { cargaMinima: 99_000_000 } }).expect(409);
      expect(cruzado.body.mensaje).toMatch(/mínima no puede ser mayor/);
      await laura.get(`${API}/configuracion`).expect(403);
    });

    it('cambiar la comisión no toca los pedidos ya creados', async () => {
      const viejo = (await laura.post(`${API}/pedidos`).send({ tipo: 'carga', telefono: '1155550001', plataformaId, monto: 1_000_000, medioPago: 'efectivo' }).expect(201)).body;
      expect(viejo.ganancia).toBe(70_000);
      await admin.put(`${API}/configuracion`).send({ comision: { porcentajePb: 500 } }).expect(200);
      expect((await laura.get(`${API}/pedidos/${viejo.id}`)).body.ganancia).toBe(70_000);
      await laura.post(`${API}/pedidos/${viejo.id}/rechazar`).send({ motivo: 'otro' }).expect(200);
    });
  });

  describe('plataformas', () => {
    it('se crean y desactivan, pero siempre queda una activa', async () => {
      const nueva = (await admin.post(`${API}/plataformas`).send({ nombre: 'Casino Dos' }).expect(201)).body;
      await admin.post(`${API}/plataformas`).send({ nombre: 'Casino Dos' }).expect(409);
      await admin.patch(`${API}/plataformas/${plataformaId}`).send({ activa: false }).expect(200);
      const ultima = await admin.patch(`${API}/plataformas/${nueva.id}`).send({ activa: false }).expect(409);
      expect(ultima.body.mensaje).toMatch(/al menos una plataforma activa/);
      await admin.patch(`${API}/plataformas/${plataformaId}`).send({ activa: true }).expect(200);
      expect((await admin.get(`${API}/plataformas`)).body).toHaveLength(2);
    });
  });

  describe('reportes', () => {
    beforeAll(async () => {
      // 3 cargas acreditadas (2 de Laura por WhatsApp y 1 web sin tomar... la toma Laura), 1 retiro pagado, 1 rechazada, 1 en curso.
      const crear = (datos: object) => laura.post(`${API}/pedidos`).send({ plataformaId, medioPago: 'efectivo', telefono: '1155550001', ...datos }).expect(201);
      const cerrar = async (id: number, tipo: 'carga' | 'retiro') => {
        await laura.post(`${API}/pedidos/${id}/tomar`).expect(200);
        await laura.post(`${API}/pedidos/${id}/verificar`).send({}).expect(200);
        await admin.post(`${API}/pedidos/${id}/${tipo === 'carga' ? 'acreditar' : 'pagar'}`).expect(200);
      };
      for (const monto of [1_000_000, 2_000_000, 500_000]) await cerrar((await crear({ tipo: 'carga', monto })).body.id, 'carga');
      await cerrar((await crear({ tipo: 'retiro', monto: 800_000 })).body.id, 'retiro');
      const rechazada = (await crear({ tipo: 'carga', monto: 300_000 })).body.id;
      await laura.post(`${API}/pedidos/${rechazada}/rechazar`).send({ motivo: 'no_llego' }).expect(200);
      await crear({ tipo: 'carga', monto: 400_000 });
    });

    it('los totales coinciden con la suma de los pedidos', async () => {
      const { body } = await admin.get(`${API}/reportes/resumen?desde=${hoy}&hasta=${hoy}`).expect(200);
      expect(body.totales).toEqual({
        pedidos: 7, // incluye la rechazada del test de configuración
        cargas: { cantidad: 3, acreditado: 3_500_000, transferido: 3_675_000 },
        retiros: { cantidad: 1, pagado: 800_000 },
        ganancia: 175_000,
        rechazados: 2,
        enCurso: 1,
      });
      // Cada desglose suma lo mismo que el total.
      const suma = (filas: { ganancia: number }[]) => filas.reduce((t, f) => t + f.ganancia, 0);
      expect(suma(body.porCanal)).toBe(body.totales.ganancia);
      expect(suma(body.porOperador)).toBe(body.totales.ganancia);
      expect(suma(body.porDia)).toBe(body.totales.ganancia);
      expect(body.porOperador).toContainEqual(expect.objectContaining({ id: lauraId, nombre: 'Laura', pedidos: 4, acreditado: 3_500_000, pagado: 800_000 }));
      expect(body.porDia).toEqual([{ fecha: hoy, pedidos: 4, cargas: 3_500_000, retiros: 800_000, ganancia: 175_000, rechazados: 2 }]);
      // Los rechazados se cuentan en cada desglose, sin sumar montos.
      const rechazados = (filas: { rechazados: number }[]) => filas.reduce((t, f) => t + f.rechazados, 0);
      expect(rechazados(body.porCanal)).toBe(2);
      expect(rechazados(body.porOperador)).toBe(2);
      expect(rechazados(body.porJugador)).toBe(2);
      const db = await prisma.pedido.aggregate({ where: { estado: { in: ['acreditado', 'pagado'] } }, _sum: { ganancia: true } });
      expect(db._sum.ganancia).toBe(body.totales.ganancia);
    });

    it('un período sin pedidos da todo en cero', async () => {
      const { body } = await admin.get(`${API}/reportes/resumen?desde=2020-01-01&hasta=2020-01-31`).expect(200);
      expect(body.totales.pedidos).toBe(0);
      await admin.get(`${API}/reportes/resumen?desde=2020-02-01&hasta=2020-01-01`).expect(400);
      await laura.get(`${API}/reportes/resumen?desde=${hoy}&hasta=${hoy}`).expect(403);
    });

    it('lista con filtros y exporta a Excel lo mismo', async () => {
      const lista = (await admin.get(`${API}/reportes/pedidos?desde=${hoy}&hasta=${hoy}&estado=acreditado`).expect(200)).body;
      expect(lista.total).toBe(3);
      const archivo = await admin
        .get(`${API}/reportes/pedidos.xlsx?desde=${hoy}&hasta=${hoy}&estado=acreditado`)
        .buffer(true)
        .parse((res, listo) => {
          const partes: Buffer[] = [];
          res.on('data', (p: Buffer) => partes.push(p));
          res.on('end', () => listo(null, Buffer.concat(partes)));
        })
        .expect(200);
      expect(archivo.headers['content-disposition']).toMatch(/attachment; filename="carga24-pedidos-/);
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(archivo.body as unknown as Parameters<typeof libro.xlsx.load>[0]);
      const hoja = libro.getWorksheet('Pedidos')!;
      expect(hoja.rowCount).toBe(4); // encabezado + 3
      expect(hoja.getRow(1).getCell(1).value).toBe('N°');
      const montos = [2, 3, 4].map((r) => hoja.getRow(r).getCell('K').value as number);
      expect(montos.reduce((a, b) => a + b, 0)).toBe(35_000);
      expect(hoja.getRow(2).getCell('N').value).toBe('Laura');
    });
  });

  describe('impuesto de la plataforma', () => {
    it('la ganancia es el % sobre lo transferido menos el impuesto; al jugador se le descuenta el % entero', async () => {
      const antes = (await admin.get(`${API}/configuracion`).expect(200)).body.comision;
      await admin.put(`${API}/configuracion`).send({ comision: { modo: 'descuento', porcentajePb: 300, impuestoPb: 250 } }).expect(200);
      try {
        const { body } = await laura.post(`${API}/pedidos`).send({ tipo: 'carga', telefono: '11 7777 0000', plataformaId, monto: 1_000_000, medioPago: 'efectivo' }).expect(201);
        expect(body).toMatchObject({ montoPagado: 1_000_000, monto: 970_000, ganancia: 29_250 });
        await laura.post(`${API}/pedidos/${body.id}/rechazar`).send({ motivo: 'otro' }).expect(200);
      } finally {
        await admin.put(`${API}/configuracion`).send({ comision: { modo: antes.modo, porcentajePb: antes.porcentajePb, impuestoPb: antes.impuestoPb ?? 0 } }).expect(200);
      }
    });
  });

  describe('auditoría', () => {
    it('filtra por persona y acción; nadie puede cambiar los registros', async () => {
      const opciones = (await admin.get(`${API}/auditoria/opciones`).expect(200)).body;
      expect(opciones.acciones).toContain('pedido.tomar');
      const deLaura = (await admin.get(`${API}/auditoria?actorId=${lauraId}&accion=pedido.&desde=${hoy}&hasta=${hoy}`).expect(200)).body;
      expect(deLaura.total).toBeGreaterThan(5);
      expect(deLaura.registros.every((r: { actor: { nombre: string }; accion: string }) => r.actor.nombre === 'Laura' && r.accion.startsWith('pedido.'))).toBe(true);
      await laura.get(`${API}/auditoria`).expect(403);
      await expect(prisma.$executeRawUnsafe('UPDATE auditoria SET accion = $1', 'x')).rejects.toThrow();
      await expect(prisma.$executeRawUnsafe('DELETE FROM auditoria')).rejects.toThrow();
    });
  });
});
