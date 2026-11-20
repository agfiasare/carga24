import { Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { perfiles } from '../../api/gestion';
import { useConsulta } from '../../api/useConsulta';
import { Aviso, Boton, Etiqueta } from '../../componentes';
import { useSesionStaff } from '../../sesion/sesion';
import { PaginaPanel } from './PaginaPanel';
import clases from './panel.module.css';

export function Perfiles() {
  const { usuario } = useSesionStaff();
  const { datos, error } = useConsulta(perfiles.listar, []);
  const navegar = useNavigate();
  return (
    <PaginaPanel
      titulo="Perfiles de permisos"
      requiere={['perfiles.gestionar']}
      acciones={
        <Boton icono={<Plus size={18} aria-hidden="true" />} onClick={() => navegar('/panel/perfiles/nuevo')}>
          Nuevo perfil
        </Boton>
      }
    >
      <p className={clases.total}>Al dar de alta a alguien se le asigna un perfil. Si se edita un perfil, cambia para todas las personas que lo tienen.</p>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      <div className={clases.envoltorioTabla}>
        <table className={clases.tabla}>
          <thead>
            <tr>
              <th scope="col">Perfil</th>
              <th scope="col">Permisos</th>
              <th scope="col">Personas</th>
            </tr>
          </thead>
          <tbody>
            {datos?.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/panel/perfiles/${p.id}`}>{p.nombre}</Link> {p.id === usuario?.perfil?.id ? <Etiqueta>El tuyo</Etiqueta> : null}
                  {p.descripcion ? <span className={clases.secundario}>{p.descripcion}</span> : null}
                </td>
                <td>{p.permisos.length}</td>
                <td>{p.cantidadUsuarios}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PaginaPanel>
  );
}
