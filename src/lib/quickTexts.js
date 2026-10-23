// Atalhos de texto do compositor da ficha: as frases que o consultor repete no
// dia a dia. Só Anotação e Ligação têm. No WhatsApp o texto digitado é a
// mensagem que abre no aparelho e vai para a pessoa, então um atalho de
// registro ("Enviei os valores") seria enviado a ela.
export const QUICK_TEXTS = Object.freeze({
  note: Object.freeze(['Pediu para ligar depois', 'Vai pensar', 'Pediu desconto', 'Treina em outra academia']),
  call: Object.freeze(['Não atendeu', 'Caixa postal', 'Atendeu e pediu retorno', 'Número errado']),
});

// Acrescenta o atalho ao que já foi digitado, numa linha nova.
export function appendQuickText(draft, text) {
  const base = String(draft ?? '').replace(/\s+$/, '');
  return base ? `${base}\n${text}` : text;
}

// Os rascunhos vazios do compositor, um por modo de texto. Mora aqui, e não no
// ProfileComposer, porque arquivo de componente só exporta componente.
export const EMPTY_DRAFTS = Object.freeze({ note: '', whatsapp: '', call: '' });
