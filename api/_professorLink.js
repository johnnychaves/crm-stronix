import { dataCollection, usersCollection } from './_auth.js';
import { professorIdProblem, professorModuleProblem, professorLinkProblem } from '../src/lib/teamRoles.js';

const PROFESSORS_PATH = 'stronix_professores';

// Confere o professor do cadastro que uma pessoa da equipe vai ser: o módulo
// Professor e faltosos ligado, e o professor existindo, ativo e sem outro
// login. Usado pelo convite, pelo aceite, pelo cadastro e pela troca de papel.
// As regras moram em src/lib/teamRoles.js, as mesmas que a tela usa para
// montar a escolha. Aqui ficam só as leituras. O underscore no nome deixa o
// arquivo fora das funções da Vercel.
//
// Devolve null quando pode seguir, ou { status, code, error } pronto para
// responder. `modules` é a lista da academia já normalizada (o getSeatUsage
// devolve). `exceptUserId` é quem está trocando de professor: o vínculo dele
// mesmo não conta como ocupado.
//
// Não é transação: dois gestores ligando o mesmo professor no mesmo instante
// passariam os dois. A academia tem um gestor ou dois e a tela esconde quem já
// tem login, então o risco foi aceito.
export async function professorLinkRefusal({ tenantId, modules, professorId, exceptUserId = null }) {
  const early = professorIdProblem(professorId) || professorModuleProblem(modules);
  if (early) return early;
  const [professorSnap, linkedSnap] = await Promise.all([
    dataCollection(tenantId, PROFESSORS_PATH).doc(professorId).get(),
    usersCollection(tenantId).where('professorId', '==', professorId).get(),
  ]);
  return professorLinkProblem({
    professor: professorSnap.exists ? (professorSnap.data() || {}) : null,
    linkedUsers: linkedSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    exceptUserId,
  });
}
