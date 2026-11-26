import { BadRequestException, Controller, Get, Injectable, Module, Query, Res } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { z } from 'zod';
import { SoloStaff } from '../auth/acceso.decorator.js';
import { RequierePermisos } from '../auth/permisos.decorator.js';
import { Validar } from '../comun/validacion.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fechaArgentina, rangoDeFechas } from './fechas.js';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha con formato AAAA-MM-DD');
const esquemaPeriodo = z
  .object({ desde: fecha, hasta: fecha })
  .refine((d) => d.desde <= d.hasta, { message: '"Desde" tiene que ser anterior a "hasta"', path: ['desde'] });

const esquemaFiltros = esquemaPeriodo.and(
  z.object({
    estado: z.enum(['pendiente', 'en_proceso', 'espera_aprobacion', 'verificado', 'acreditado', 'pagado', 'rechazado']).optional(),
    tipo: z.enum(['carga', 'retiro']).optional(),
    canal: z.enum(['web', 'manual']).optional(),
    operadorId: z.uuid().optional(),
    jugadorId: z.uuid().optional(),
    buscar: z.string().trim().max(60).optional(),
    pagina: z.coerce.number().int().min(1).default(1),
  }),
);
type Filtros = z.infer<typeof esquemaFiltros>;

const POR_PAGINA = 50;
const MAXIMO_EXPORTACION = 50_000;
const nombre = (p: { nombreVisible: string | null; nombreUsuario: string | null } | null) => (p ? (p.nombreVisible ?? p.nombreUsuario ?? '') : null);
const PERSONA = { select: { id: true, nombreVisible: true, nombreUsuario: true } } as const;

/**
 * Reportes del negocio. Un pedido cuenta en el período según su fecha de creación.
 * Solo suman los cerrados con éxito (cargas acreditadas, retiros pagados); los demás se cuentan aparte.
 * Todos los totales salen de sumar los mismos pedidos, así que siempre cierran.
 */
@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen(desde: string, hasta: string) {
    const pedidos = await this.prisma.pedido.findMany({
      where: { creadoEn: rangoDeFechas(desde, hasta)! },
      select: {
        id: true, tipo: true, estado: true, canal: true, monto: true, montoPagado: true, ganancia: true, creadoEn: true,
        tomadoPor: PERSONA,
        jugador: { select: { id: true, nombreUsuario: true, telefono: true } },
        telefono: true,
      },
    });

    const totales = {
      pedidos: pedidos.length,
      cargas: { cantidad: 0, acreditado: 0, transferido: 0 },
      retiros: { cantidad: 0, pagado: 0 },
      ganancia: 0,
      rechazados: 0,
      enCurso: 0,
    };
    const porCanal = new Map<string, { canal: string; cargas: number; retiros: number; ganancia: number; pedidos: number; rechazados: number }>();
    const porOperador = new Map<string, { id: string | null; nombre: string; pedidos: number; acreditado: number; pagado: number; ganancia: number; rechazados: number }>();
    const porJugador = new Map<string, { id: string | null; telefono: string | null; jugador: string; pedidos: number; cargado: number; retirado: number; rechazados: number }>();
    const porDia = new Map<string, { fecha: string; pedidos: number; cargas: number; retiros: number; ganancia: number; rechazados: number }>();
    /** Las filas de cada desglose a las que pertenece un pedido (se crean al primer uso). */
    const grupos = (p: (typeof pedidos)[number]) => {
      const claveOperador = p.tomadoPor?.id ?? 'sin';
      const claveJugador = p.jugador?.id ?? `tel:${p.telefono}`;
      const dia = fechaArgentina(p.creadoEn);
      if (!porCanal.has(p.canal)) porCanal.set(p.canal, { canal: p.canal, cargas: 0, retiros: 0, ganancia: 0, pedidos: 0, rechazados: 0 });
      if (!porOperador.has(claveOperador)) porOperador.set(claveOperador, { id: p.tomadoPor?.id ?? null, nombre: nombre(p.tomadoPor) ?? 'Sin asignar', pedidos: 0, acreditado: 0, pagado: 0, ganancia: 0, rechazados: 0 });
      if (!porJugador.has(claveJugador)) {
        porJugador.set(claveJugador, { id: p.jugador?.id ?? null, telefono: p.jugador ? null : p.telefono, jugador: p.jugador?.nombreUsuario ?? p.jugador?.telefono ?? p.telefono ?? '—', pedidos: 0, cargado: 0, retirado: 0, rechazados: 0 });
      }
      if (!porDia.has(dia)) porDia.set(dia, { fecha: dia, pedidos: 0, cargas: 0, retiros: 0, ganancia: 0, rechazados: 0 });
      return { canal: porCanal.get(p.canal)!, operador: porOperador.get(claveOperador)!, jugador: porJugador.get(claveJugador)!, dia: porDia.get(dia)! };
    };

    for (const p of pedidos) {
      if (p.estado === 'rechazado') {
        totales.rechazados++;
        // Los rechazados no suman montos, pero se cuentan en cada desglose.
        for (const g of Object.values(grupos(p))) g.rechazados++;
        continue;
      }
      const cerrado = p.estado === 'acreditado' || p.estado === 'pagado';
      if (!cerrado) {
        totales.enCurso++;
        continue;
      }
      const carga = p.tipo === 'carga' ? p.monto : 0;
      const retiro = p.tipo === 'retiro' ? p.monto : 0;
      if (p.tipo === 'carga') {
        totales.cargas.cantidad++;
        totales.cargas.acreditado += p.monto;
        totales.cargas.transferido += p.montoPagado ?? p.monto;
      } else {
        totales.retiros.cantidad++;
        totales.retiros.pagado += p.monto;
      }
      totales.ganancia += p.ganancia;

      const { canal, operador, jugador, dia } = grupos(p);
      Object.assign(canal, { cargas: canal.cargas + carga, retiros: canal.retiros + retiro, ganancia: canal.ganancia + p.ganancia, pedidos: canal.pedidos + 1 });
      Object.assign(operador, { pedidos: operador.pedidos + 1, acreditado: operador.acreditado + carga, pagado: operador.pagado + retiro, ganancia: operador.ganancia + p.ganancia });
      Object.assign(jugador, { pedidos: jugador.pedidos + 1, cargado: jugador.cargado + carga, retirado: jugador.retirado + retiro });
      Object.assign(dia, { pedidos: dia.pedidos + 1, cargas: dia.cargas + carga, retiros: dia.retiros + retiro, ganancia: dia.ganancia + p.ganancia });
    }

    return {
      desde,
      hasta,
      totales,
      porCanal: [...porCanal.values()].sort((a, b) => b.ganancia - a.ganancia),
      porOperador: [...porOperador.values()].sort((a, b) => b.ganancia - a.ganancia),
      porJugador: [...porJugador.values()].sort((a, b) => b.cargado - a.cargado).slice(0, 20),
      porDia: [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    };
  }

  private donde(f: Filtros): Prisma.PedidoWhereInput {
    const buscar = f.buscar?.replace(/^#/, '');
    return {
      creadoEn: rangoDeFechas(f.desde, f.hasta)!,
      ...(f.estado ? { estado: f.estado } : {}),
      ...(f.tipo ? { tipo: f.tipo } : {}),
      ...(f.canal ? { canal: f.canal } : {}),
      ...(f.operadorId ? { tomadoPorId: f.operadorId } : {}),
      ...(f.jugadorId ? { jugadorId: f.jugadorId } : {}),
      ...(buscar
        ? {
            OR: [
              ...(/^\d{1,9}$/.test(buscar) ? [{ id: Number(buscar) }] : []),
              { telefono: { contains: buscar.replace(/\D/g, '') || buscar } },
              { referenciaMovimiento: { contains: buscar, mode: 'insensitive' as const } },
              { jugador: { nombreUsuario: { contains: buscar, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
  }

  private readonly incluir = {
    jugador: { select: { nombreUsuario: true, telefono: true, usuarioPlataforma: true } },
    plataforma: { select: { nombre: true } },
    tomadoPor: PERSONA,
    verificadoPor: PERSONA,
    ejecutadoPor: PERSONA,
  } as const;

  async pedidos(f: Filtros) {
    const where = this.donde(f);
    const [total, filas] = await Promise.all([
      this.prisma.pedido.count({ where }),
      this.prisma.pedido.findMany({ where, include: this.incluir, orderBy: { id: 'desc' }, skip: (f.pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
    ]);
    return {
      total,
      pagina: f.pagina,
      porPagina: POR_PAGINA,
      pedidos: filas.map((p) => ({
        id: p.id, tipo: p.tipo, estado: p.estado, canal: p.canal, monto: p.monto, montoPagado: p.montoPagado, ganancia: p.ganancia,
        creadoEn: p.creadoEn, jugador: p.jugador?.nombreUsuario ?? p.jugador?.telefono ?? p.telefono, operador: nombre(p.tomadoPor),
        referenciaMovimiento: p.referenciaMovimiento,
      })),
    };
  }

  /** Planilla de Excel con los mismos filtros que el listado. Montos en pesos, con formato de moneda. */
  async excel(f: Filtros): Promise<Buffer> {
    const where = this.donde(f);
    const total = await this.prisma.pedido.count({ where });
    if (total > MAXIMO_EXPORTACION) throw new BadRequestException(`Son ${total} pedidos: achicá el período (máximo ${MAXIMO_EXPORTACION}).`);
    const filas = await this.prisma.pedido.findMany({ where, include: this.incluir, orderBy: { id: 'asc' } });

    const libro = new ExcelJS.Workbook();
    libro.creator = 'Carga24';
    const hoja = libro.addWorksheet('Pedidos', { views: [{ state: 'frozen', ySplit: 1 }] });
    const pesos = '"$" #,##0.00';
    hoja.columns = [
      { header: 'N°', key: 'id', width: 8 },
      { header: 'Fecha', key: 'fecha', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
      { header: 'Tipo', key: 'tipo', width: 9 },
      { header: 'Estado', key: 'estado', width: 16 },
      { header: 'Canal', key: 'canal', width: 11 },
      { header: 'Jugador', key: 'jugador', width: 18 },
      { header: 'Teléfono', key: 'telefono', width: 16 },
      { header: 'Usuario en plataforma', key: 'usuarioPlataforma', width: 20 },
      { header: 'Plataforma', key: 'plataforma', width: 18 },
      { header: 'Transfiere el jugador', key: 'pagado', width: 18, style: { numFmt: pesos } },
      { header: 'Acreditado / transferido', key: 'monto', width: 20, style: { numFmt: pesos } },
      { header: 'Comisión %', key: 'comisionPct', width: 11, style: { numFmt: '0.00"%"' } },
      { header: 'Ganancia', key: 'ganancia', width: 14, style: { numFmt: pesos } },
      { header: 'Tomó', key: 'tomo', width: 14 },
      { header: 'Verificó', key: 'verifico', width: 14 },
      { header: 'Acreditó / pagó', key: 'ejecuto', width: 16 },
      { header: 'N° de operación', key: 'referencia', width: 18 },
      { header: 'Motivo de rechazo', key: 'motivo', width: 30 },
    ];
    hoja.getRow(1).font = { bold: true };
    for (const p of filas) {
      hoja.addRow({
        id: p.id,
        // Excel no guarda zona horaria: se escribe la hora de Argentina.
        fecha: new Date(p.creadoEn.getTime() - 3 * 60 * 60 * 1000),
        tipo: p.tipo,
        estado: p.estado.replace('_', ' '),
        canal: p.canal === 'manual' ? 'WhatsApp' : 'Web',
        jugador: p.jugador?.nombreUsuario ?? '',
        telefono: p.telefono ?? '',
        usuarioPlataforma: p.jugador?.usuarioPlataforma ?? '',
        plataforma: p.plataforma.nombre,
        pagado: p.montoPagado === null ? null : p.montoPagado / 100,
        monto: p.monto / 100,
        comisionPct: p.comisionPb / 100,
        // Solo hay ganancia en los cerrados con éxito; el resto queda vacío para no inflar la suma.
        ganancia: p.estado === 'acreditado' || p.estado === 'pagado' ? p.ganancia / 100 : null,
        tomo: nombre(p.tomadoPor) ?? '',
        verifico: nombre(p.verificadoPor) ?? '',
        ejecuto: nombre(p.ejecutadoPor) ?? '',
        referencia: p.referenciaMovimiento ?? '',
        motivo: p.motivoRechazo ?? '',
      });
    }
    hoja.autoFilter = { from: 'A1', to: 'R1' };
    return Buffer.from(await libro.xlsx.writeBuffer());
  }
}

@SoloStaff()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('resumen')
  @RequierePermisos('reportes.ver')
  resumen(@Query(new Validar(esquemaPeriodo)) periodo: z.infer<typeof esquemaPeriodo>) {
    return this.reportes.resumen(periodo.desde, periodo.hasta);
  }

  @Get('pedidos')
  @RequierePermisos('reportes.ver')
  pedidos(@Query(new Validar(esquemaFiltros)) filtros: Filtros) {
    return this.reportes.pedidos(filtros);
  }

  @Get('pedidos.xlsx')
  @RequierePermisos('reportes.exportar')
  async excel(@Query(new Validar(esquemaFiltros)) filtros: Filtros, @Res() respuesta: Response): Promise<void> {
    const archivo = await this.reportes.excel(filtros);
    respuesta.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="carga24-pedidos-${filtros.desde}-a-${filtros.hasta}.xlsx"`,
      'Cache-Control': 'private, no-store',
    });
    respuesta.send(archivo);
  }
}

@Module({ controllers: [ReportesController], providers: [ReportesService] })
export class ReportesModule {}
