import { useState } from 'react';
import { cn } from '../../lib/utils.js';
import { MODULES, hasModule, normalizeModules } from '../../lib/modules.js';

// Módulos da academia, na página dela no super console. Cada chave liga ou
// desliga um módulo em tenants/{id}.modules. Quem grava é o `save` que o
// Detail passa (api/tenant-status.js, só o super-admin), e o cartão manda
// sempre a lista inteira. O app lê a lista no login, então a troca vale no
// próximo login ou F5 de cada pessoa da academia.
// O visual segue o do console (classes de console.css, como a chave "Conta
// interna" do Nova academia), e não os tokens do app.
const MODULE_ROWS = [
  {
    key: MODULES.FALTOSOS,
    title: 'Professor e faltosos',
    hint: 'Libera o papel Professor em Equipe & acessos. Vale no próximo login ou F5 de cada pessoa.',
  },
];

// Desligar o módulo com professor de login deixa essas pessoas só com o aviso
// de acesso desligado (o professor continua com o papel, sem tela nenhuma).
function confirmText(professores) {
  return professores === 1
    ? 'Desligar Professor e faltosos? O professor com login passa a ver só o aviso de acesso desligado, a partir do próximo login ou F5.'
    : `Desligar Professor e faltosos? Os ${professores} professores com login passam a ver só o aviso de acesso desligado, a partir do próximo login ou F5.`;
}

function TenantModulesCard({ tenant, save, professores = 0 }) {
  const ligados = normalizeModules(tenant?.modules);
  // Módulo sendo gravado agora. Enquanto há um, nenhuma chave aceita clique.
  const [salvando, setSalvando] = useState(null);
  const [erro, setErro] = useState('');

  const alternar = async (key) => {
    if (salvando) return;
    const ligado = hasModule(ligados, key);
    if (ligado && key === MODULES.FALTOSOS && professores > 0 && !window.confirm(confirmText(professores))) return;
    const proxima = ligado ? ligados.filter((m) => m !== key) : [...ligados, key];
    setSalvando(key);
    setErro('');
    try {
      await save(normalizeModules(proxima));
    } catch (e) {
      setErro(e?.message || 'Não deu para salvar o módulo.');
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="card">
      <div className="card-h"><h3>Módulos</h3></div>
      <div className="card-pad" style={{ display: 'grid', gap: 12 }}>
        {MODULE_ROWS.map((row) => {
          const ligado = hasModule(ligados, row.key);
          const gravando = salvando === row.key;
          return (
            <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                role="switch"
                aria-checked={ligado}
                aria-label={row.title}
                disabled={!!salvando}
                className={cn('sw', ligado && 'on', gravando && 'partial')}
                style={{ padding: 0 }}
                onClick={() => alternar(row.key)}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{row.title}{gravando ? ' · salvando…' : ''}</div>
                <div className="muted" style={{ fontSize: 11 }}>{row.hint}</div>
              </div>
            </div>
          );
        })}
        {erro && <div role="alert" style={{ color: 'var(--danger)', fontSize: 12.5 }}>{erro}</div>}
      </div>
    </div>
  );
}

export { TenantModulesCard };
