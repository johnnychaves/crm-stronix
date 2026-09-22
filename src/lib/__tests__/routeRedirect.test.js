// RouteRedirect em node, sem jsdom. O renderToString não roda effect, então os
// hooks são simulados: o useEffect guarda a função, o teste a roda como o
// React faria depois do commit, e confere o aviso e a troca de endereço.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouteRedirect } from '../../components/RouteRedirect.jsx';
import { ROUTE_NOTICES } from '../routes.js';

const m = vi.hoisted(() => ({
  effect: null,
  deps: null,
  navigate: vi.fn(),
  toast: { warning: vi.fn() },
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useEffect: (effect, deps) => {
      m.effect = effect;
      m.deps = deps;
    },
  };
});

vi.mock('react-router', () => ({ useNavigate: () => m.navigate }));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => m.toast }));

function mountAndCommit(props) {
  const output = RouteRedirect(props);
  m.effect();
  return output;
}

beforeEach(() => {
  m.effect = null;
  m.deps = null;
  m.navigate.mockClear();
  m.toast.warning.mockClear();
});

describe('RouteRedirect', () => {
  it('mostra o aviso de gestor e troca o endereço sem empilhar histórico', () => {
    const output = mountAndCommit({ to: '/acad', notice: 'so-gestor' });
    expect(output).toBe(null);
    expect(m.toast.warning).toHaveBeenCalledWith(ROUTE_NOTICES['so-gestor']);
    expect(m.toast.warning).toHaveBeenCalledWith('Essa tela é só do gestor.');
    expect(m.navigate).toHaveBeenCalledWith('/acad', { replace: true });
  });

  it('sem aviso, só troca o endereço', () => {
    mountAndCommit({ to: '/acad/pipeline', notice: null });
    expect(m.toast.warning).not.toHaveBeenCalled();
    expect(m.navigate).toHaveBeenCalledWith('/acad/pipeline', { replace: true });
  });

  it('aviso que não existe não mostra nada e ainda troca o endereço', () => {
    mountAndCommit({ to: '/acad', notice: 'xyz' });
    expect(m.toast.warning).not.toHaveBeenCalled();
    expect(m.navigate).toHaveBeenCalledWith('/acad', { replace: true });
  });

  it('nome herdado do protótipo não vira aviso', () => {
    mountAndCommit({ to: '/acad', notice: 'toString' });
    expect(m.toast.warning).not.toHaveBeenCalled();
    expect(m.navigate).toHaveBeenCalledWith('/acad', { replace: true });
  });

  it('o effect depende do destino e do aviso', () => {
    mountAndCommit({ to: '/acad', notice: 'nao-encontrada' });
    expect(m.deps).toEqual(['/acad', 'nao-encontrada', m.navigate, m.toast]);
  });
});
