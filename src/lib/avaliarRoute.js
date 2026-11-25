// /avaliar/<academia>/<código> abre a pesquisa de NPS dos alunos (PR 5 do perfil
// do professor), decidida no App() antes do roteador. Qualquer endereço que
// comece por /avaliar é desta página: o que não tem os dois segmentos chega ao
// servidor como link inválido e mostra "Link fora do ar", em vez de cair no
// app como uma academia chamada "avaliar".
export function avaliarRouteOf(pathname) {
  const partes = String(pathname || '').split('/').filter(Boolean);
  if (partes[0] !== 'avaliar') return null;
  return { slug: String(partes[1] || '').toLowerCase(), code: String(partes[2] || '') };
}
