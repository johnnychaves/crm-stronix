// Onde o login grava a sessão do Firebase Auth. Puro, sem importar o SDK: a
// tradução para a classe de persistência fica em firebase.js (persistenceFor).
//
// Por que existe: o getAuth abre a página vigiando o IndexedDB, e o vigia fica
// preso a esse lugar (PersistenceUserManager do @firebase/auth 1.12.2). O login
// com "Manter conectado" gravava no localStorage. A aba seguinte achava a sessão
// ali, movia para o IndexedDB e apagava do localStorage, e a primeira aba lia o
// localStorage vazio e deslogava. Gravar no IndexedDB fecha isso.
export function persistenceKind({ remember, indexedDbOk }) {
  if (!remember) return 'session';
  return indexedDbOk ? 'indexedDB' : 'local';
}
