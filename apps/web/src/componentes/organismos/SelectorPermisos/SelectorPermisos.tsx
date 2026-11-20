import { PERMISOS, TODOS_LOS_PERMISOS, type Permiso } from '@carga24/shared';
import { Casilla } from '../../atomos/Casilla/Casilla';
import { Etiqueta } from '../../atomos/Etiqueta/Etiqueta';
import clases from './SelectorPermisos.module.css';

export interface SelectorPermisosProps {
  valor: ReadonlySet<Permiso>;
  onCambiar: (permisos: Set<Permiso>) => void;
  /**
   * Permisos del perfil. Si se pasa, se marcan las diferencias:
   * lo que se agrega o se quita a esta persona por encima de su perfil.
   */
  base?: ReadonlySet<Permiso>;
  deshabilitado?: boolean;
}

/** Agrupa los permisos según el catálogo de @carga24/shared. */
export const GRUPOS_PERMISOS: { grupo: string; permisos: Permiso[] }[] = Object.values(
  TODOS_LOS_PERMISOS.reduce<Record<string, { grupo: string; permisos: Permiso[] }>>((acc, permiso) => {
    const { grupo } = PERMISOS[permiso];
    (acc[grupo] ??= { grupo, permisos: [] }).permisos.push(permiso);
    return acc;
  }, {}),
);

/** Permisos con casillas, por grupo. Sirve para perfiles y para ajustes individuales. */
export function SelectorPermisos({ valor, onCambiar, base, deshabilitado = false }: SelectorPermisosProps) {
  function alternar(permiso: Permiso, marcado: boolean) {
    const nuevo = new Set(valor);
    if (marcado) nuevo.add(permiso);
    else nuevo.delete(permiso);
    onCambiar(nuevo);
  }

  function alternarGrupo(permisos: Permiso[], marcar: boolean) {
    const nuevo = new Set(valor);
    for (const p of permisos) {
      if (marcar) nuevo.add(p);
      else nuevo.delete(p);
    }
    onCambiar(nuevo);
  }

  return (
    <div className={clases.grupos}>
      {GRUPOS_PERMISOS.map(({ grupo, permisos }) => {
        const todos = permisos.every((p) => valor.has(p));
        return (
          <fieldset key={grupo} className={clases.grupo} disabled={deshabilitado}>
            <legend className={clases.leyenda}>{grupo}</legend>
            <button
              type="button"
              className={clases.todos}
              onClick={() => alternarGrupo(permisos, !todos)}
              disabled={deshabilitado}
              aria-label={`${todos ? 'Quitar' : 'Marcar'} todos los permisos de ${grupo}`}
            >
              {todos ? 'Quitar todos' : 'Marcar todos'}
            </button>
            {permisos.map((permiso) => {
              const marcado = valor.has(permiso);
              const diferencia = base && marcado !== base.has(permiso) ? (marcado ? 'agregado' : 'quitado') : null;
              return (
                <Casilla
                  key={permiso}
                  checked={marcado}
                  onChange={(e) => alternar(permiso, e.target.checked)}
                  etiqueta={
                    <span className={clases.etiqueta}>
                      {PERMISOS[permiso].descripcion}
                      {diferencia ? <Etiqueta tono={diferencia === 'agregado' ? 'ok' : 'error'}>{diferencia === 'agregado' ? 'Agregado' : 'Quitado'}</Etiqueta> : null}
                    </span>
                  }
                />
              );
            })}
          </fieldset>
        );
      })}
    </div>
  );
}
