import { MOTIVOS_RECHAZO, formatearPesos, type MotivoRechazo } from '@carga24/shared';
import { useState } from 'react';
import { pedidos, type Pedido } from '../../../api/pedidos';
import { useAccion } from '../../../api/useAccion';
import { Aviso, CampoFormulario, ModalConfirmacion, SelectorFormulario } from '../../../componentes';
import { nombreJugador, ResumenPedido, textoCuenta } from './comun';
import clases from './cola.module.css';

export type AccionModal = 'tomar' | 'verificar' | 'aprobar' | 'acreditar' | 'pagar' | 'rechazar' | 'no_llego';

interface Props {
  pedido: Pedido;
  accion: AccionModal;
  alCerrar: () => void;
  alTerminar: (pedido: Pedido) => void;
}

/** Cada acción importante pasa por un modal: resumen del pedido, datos a completar y qué pasa al confirmar. */
export function ModalAccion({ pedido, accion, alCerrar, alTerminar }: Props) {
  const [referencia, setReferencia] = useState('');
  const [motivo, setMotivo] = useState<MotivoRechazo | ''>(accion === 'no_llego' ? 'no_llego' : '');
  const [detalle, setDetalle] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const carga = pedido.tipo === 'carga';
  const efectivo = pedido.medioPago === 'efectivo';

  const { ejecutar, cargando, error } = useAccion(async () => {
    switch (accion) {
      case 'tomar':
        return pedidos.tomar(pedido.id);
      case 'verificar':
        return pedidos.verificar(pedido.id, referencia.trim() || undefined);
      case 'aprobar':
        return pedidos.aprobar(pedido.id);
      case 'acreditar':
        return pedidos.acreditar(pedido.id);
      case 'pagar':
        if (archivo) await pedidos.adjuntar(pedido.id, archivo, 'retiro');
        return pedidos.pagar(pedido.id);
      case 'rechazar':
      case 'no_llego':
        return pedidos.rechazar(pedido.id, motivo as MotivoRechazo, detalle.trim() || undefined);
    }
  });

  async function confirmar() {
    const resultado = await ejecutar();
    if (resultado) alTerminar(resultado.valor);
  }

  const jugador = nombreJugador(pedido);
  const textos: Record<AccionModal, { titulo: string; boton: string; peligro?: boolean; listo: boolean; despues: string }> = {
    tomar: {
      titulo: `¿Tomás el pedido #${pedido.id}?`,
      boton: 'Tomar pedido',
      listo: true,
      despues: 'Mientras lo tengas, nadie más puede procesarlo. Si te equivocaste, lo liberás y vuelve a Pendientes.',
    },
    verificar: carga
      ? {
          titulo: '¿Encontraste el pago en el banco?',
          boton: 'Sí, verificar pago',
          listo: efectivo || referencia.trim().length > 0,
          despues: `Pasa a "Por acreditar / pagar".${pedido.cuenta?.estado === 'pendiente' ? ' Como la cuenta está pendiente, este pago la verifica.' : ''}`,
        }
      : {
          titulo: '¿Validás este retiro?',
          boton: 'Validar retiro',
          listo: true,
          despues: pedido.requiereAprobacion
            ? 'Supera el límite: primero lo aprueba un supervisor y después pasa a "Por acreditar / pagar".'
            : 'Pasa a "Por acreditar / pagar" para que lo transfieran.',
        },
    aprobar: { titulo: `¿Aprobás el retiro #${pedido.id}?`, boton: 'Aprobar retiro', listo: true, despues: 'Pasa a "Por acreditar / pagar" para que lo transfieran.' },
    acreditar: {
      titulo: `¿Ya acreditaste ${formatearPesos(pedido.monto)}?`,
      boton: 'Marcar acreditada',
      listo: true,
      despues: `Confirmá que cargaste el saldo en ${pedido.plataforma.nombre} a ${pedido.jugador?.usuarioPlataforma ?? jugador}. El pedido se cierra y el jugador recibe el aviso.`,
    },
    pagar: {
      titulo: `¿Ya transferiste ${formatearPesos(pedido.monto)}?`,
      boton: 'Marcar pagado',
      listo: efectivo || archivo !== null || pedido.comprobantes.some((c) => c.tipo === 'retiro'),
      despues: efectivo ? 'Confirmá que entregaste el efectivo. El pedido se cierra.' : `Transferencia a ${textoCuenta(pedido.cuenta)}. El pedido se cierra y el jugador recibe el aviso.`,
    },
    rechazar: { titulo: `Rechazar el pedido #${pedido.id}`, boton: 'Rechazar', peligro: true, listo: motivo !== '', despues: 'El jugador ve el motivo. El rechazo es final.' },
    no_llego: { titulo: `El pago del pedido #${pedido.id} no llegó`, boton: 'Rechazar', peligro: true, listo: motivo !== '', despues: 'El jugador ve el motivo. El rechazo es final.' },
  };
  const t = textos[accion];

  return (
    <ModalConfirmacion
      titulo={t.titulo}
      textoConfirmar={t.boton}
      variante={t.peligro ? 'peligro' : 'primario'}
      cargando={cargando}
      confirmarDeshabilitado={!t.listo}
      alConfirmar={() => void confirmar()}
      alCerrar={alCerrar}
    >
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      <ResumenPedido pedido={pedido} />
      {accion === 'verificar' && carga && !efectivo ? (
        <CampoFormulario
          etiqueta="Número de operación del banco"
          ayuda="Obligatorio. Un mismo número no se puede usar en dos pedidos."
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
          autoComplete="off"
        />
      ) : null}
      {accion === 'pagar' && !efectivo ? (
        <label className={clases.campoArchivo}>
          <span>Comprobante de la transferencia {pedido.comprobantes.some((c) => c.tipo === 'retiro') ? '(ya hay uno cargado)' : '(obligatorio)'}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
        </label>
      ) : null}
      {accion === 'rechazar' || accion === 'no_llego' ? (
        <>
          <SelectorFormulario
            etiqueta="Motivo"
            vacio="Elegí un motivo"
            opciones={Object.entries(MOTIVOS_RECHAZO).map(([valor, texto]) => ({ valor, texto }))}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value as MotivoRechazo)}
          />
          <CampoFormulario etiqueta="Detalle (opcional)" value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={300} />
        </>
      ) : null}
      <p className={clases.despues}>{t.despues}</p>
      {!t.listo && accion !== 'rechazar' && accion !== 'no_llego' ? (
        <p className={clases.secundario}>{accion === 'pagar' ? 'Adjuntá el comprobante para confirmar.' : 'Completá el número de operación para confirmar.'}</p>
      ) : null}
    </ModalConfirmacion>
  );
}
