import { TODOS_LOS_PERMISOS, type Permiso } from '@carga24/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GRUPOS_PERMISOS, SelectorPermisos } from './SelectorPermisos';

describe('SelectorPermisos', () => {
  it('muestra todos los permisos del catálogo, agrupados', () => {
    render(<SelectorPermisos valor={new Set()} onCambiar={() => undefined} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(TODOS_LOS_PERMISOS.length);
    expect(screen.getAllByRole('group')).toHaveLength(GRUPOS_PERMISOS.length);
  });

  it('marca un permiso y un grupo entero', async () => {
    const onCambiar = vi.fn();
    render(<SelectorPermisos valor={new Set()} onCambiar={onCambiar} />);
    await userEvent.click(screen.getByLabelText('Tomar pedidos'));
    expect(onCambiar).toHaveBeenLastCalledWith(new Set(['pedidos.tomar']));
    await userEvent.click(screen.getByRole('button', { name: 'Marcar todos los permisos de Jugadores' }));
    expect([...onCambiar.mock.lastCall![0]]).toContain('jugadores.bloquear');
  });

  it('marca lo agregado y lo quitado respecto del perfil', () => {
    const base = new Set<Permiso>(['pedidos.ver', 'pedidos.tomar']);
    render(<SelectorPermisos base={base} valor={new Set<Permiso>(['pedidos.ver', 'jugadores.bloquear'])} onCambiar={() => undefined} />);
    expect(screen.getByText('Agregado')).toBeInTheDocument();
    expect(screen.getByText('Quitado')).toBeInTheDocument();
  });
});
