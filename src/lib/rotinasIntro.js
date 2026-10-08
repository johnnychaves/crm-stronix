// Quando a apresentação das Rotinas (o carrossel do balão "Novo", em
// src/components/rotinas/RotinasIntro.jsx) abre sozinha. Pedido do Johnny em
// 08/10/2026: ela abre quando o gestor entra em Rotinas, na lista ou na aba
// Hoje (nunca no modelo aberto), até ele marcar "Não mostrar novamente".
//
// - Dispensada para sempre: o campo introsDismissed.rotinas igual a true no
//   cadastro da própria pessoa (stronix_users/{id}), gravado pelo
//   dismissRotinasIntro (src/lib/rotinasWrites.js). O mapa deixa espaço para
//   outras apresentações sem campo novo a cada uma.
// - Vista nesta sessão: uma marca no sessionStorage, por academia e por
//   pessoa, para a apresentação abrir no máximo uma vez por aba. Voltar de um
//   modelo para a lista remonta a tela, e a marca é o que impede a reabertura.
//   O Sair recarrega a página e o sessionStorage sobrevive ao recarregar, por
//   isso a marca leva quem está logado: quem entra depois na mesma aba vê a
//   apresentação dele. Sem sessionStorage (bloqueado, cheio), a marca fica na
//   memória do módulo, que dura até o recarregar.
//
// O appUser é montado uma vez no login e não acompanha o cadastro. Por isso o
// "Não mostrar novamente" também marca a sessão, e a tela confere o cadastro
// ao vivo da equipe (usersList) além do appUser.

export const INTROS_DISMISSED_FIELD = 'introsDismissed';
export const ROTINAS_INTRO_ID = 'rotinas';

export const rotinasIntroDismissed = (user) => user?.[INTROS_DISMISSED_FIELD]?.[ROTINAS_INTRO_ID] === true;

const seenInMemory = new Set();
const sessionKey = (user) => `stronilead:apresentacao-rotinas:${user?.tenantId ?? ''}:${user?.id ?? ''}`;

export function rotinasIntroSeen(user) {
  const key = sessionKey(user);
  if (seenInMemory.has(key)) return true;
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function markRotinasIntroSeen(user) {
  const key = sessionKey(user);
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    seenInMemory.add(key);
  }
}

// `liveUser` é o cadastro da pessoa na lista da equipe, que chega por
// assinatura: pega a dispensa feita em outra aba depois do login.
export function shouldAutoOpenRotinasIntro(user, liveUser = null) {
  if (!user?.id) return false;
  if (rotinasIntroDismissed(user) || rotinasIntroDismissed(liveUser)) return false;
  return !rotinasIntroSeen(user);
}
