# Cadastro completo do cliente

status: ativo
data: 2026-07-20

## Problema

No Stronilead o "cliente" é um lead que foi matriculado. Os dados dele vivem no
mesmo documento do lead. O formulário que edita esse cadastro na ficha
("Editar cadastro", no ícone de lápis → `EditLeadModal`) captura pouco: nome,
WhatsApp, origem, observação, etiquetas, consultor, nascimento e CPF.

Isso deixa três buracos:

1. O cadastro de criação (`AddLeadModal`) coleta e-mail e sexo, mas o de edição
   não. Quem edita um cliente não consegue atualizar esses campos, e a ausência
   deles no editar dá a impressão de que se perderam.
2. Falta tudo que o cadastro de um aluno de academia normalmente tem: endereço
   completo, contato de emergência, RG, estado civil e profissão.
3. A ficha do cliente não mostra nenhum desses dados. Mesmo o que existe (CPF,
   nascimento) só aparece dentro do modal de edição.

O objetivo é deixar o cadastro do cliente completo: um formulário que reúne todos
os dados do aluno e uma seção na ficha que os exibe.

## Decisões (definidas com o Johnny)

- **Blocos novos:** Endereço completo, Contato de emergência, e Documentos e
  pessoais (RG, estado civil, profissão). **Sem** dados de saúde / PAR-Q (fica
  fora de escopo e longe de dado sensível de LGPD).
- **Foto do aluno:** fora de escopo desta entrega (vira entrega separada). O
  avatar segue com iniciais.
- **Só cliente:** o cadastro completo é exclusivo do cliente. O lead mantém o
  formulário enxuto de hoje, sem alteração.
- **Entrada:** o mesmo ícone de lápis da ficha. Para cliente ele abre o cadastro
  completo; para lead abre o `EditLeadModal` atual.
- **Card de leitura:** a ficha do cliente ganha uma seção "Cadastro" que mostra
  os dados preenchidos, sem precisar abrir o modal. O lápis continua sendo quem
  edita.
- **Obrigatoriedade:** só o Nome é obrigatório para salvar. Todo o resto é
  opcional, com um medidor leve de "cadastro X% completo" para incentivar sem
  travar o dia a dia.

## Escopo

1. Componente novo `ClientRegistrationModal.jsx`: o cadastro completo do cliente,
   no mesmo idioma visual do `EditLeadModal` (seções, rótulos, chips de
   etiqueta), com os blocos novos.
2. `LeadProfileView`: o lápis passa a abrir `ClientRegistrationModal` quando o
   registro é cliente (`isClient`); segue abrindo `EditLeadModal` para lead.
3. `LeadProfileView`: nova seção de leitura "Cadastro" na ficha do cliente,
   exibindo identidade, endereço, contato de emergência e dados pessoais.
4. Função pura `buildClientRegistrationPatch` em `lib/`, com teste unitário.

## Fora de escopo

- Foto / upload de imagem do aluno.
- Dados de saúde / PAR-Q.
- Qualquer mudança no cadastro do lead (enxuto) ou no `AddLeadModal`.
- Exigir cadastro completo no momento da matrícula (a matrícula segue como está).

## Modelo de dados

Campos novos no documento do lead (`stronix_leads/{leadId}`). Populados só para
cliente, mas guardados no mesmo doc:

| Campo | Tipo | Observação |
|---|---|---|
| `rg` | string \| null | Documento de identidade |
| `maritalStatus` | string \| null | Estado civil (select) |
| `profession` | string \| null | Profissão (texto) |
| `address` | mapa \| null | `{ cep, street, number, complement, neighborhood, city, state }` |
| `emergencyContact` | mapa \| null | `{ name, phone, relationship }` |

E-mail (`email`) e sexo (`sexo`) já existem no doc; passam a ser editáveis no
novo modal.

Regras de escrita da função pura:
- Máscaras (CPF, telefone) guardam o valor formatado como hoje; os campos de
  busca (`buildLeadSearchFields`) são recomputados a partir de name/whatsapp/cpf.
- Campo de texto vazio grava `null`.
- `address` e `emergencyContact` gravam o mapa quando pelo menos um subcampo tem
  valor; caso contrário gravam `null`.

Sem migração (Firestore é schemaless). Sem índice novo. Sem mudança nas regras:
a regra de update de lead (`firestore.rules`) é agnóstica de campo
(`isAdmin || dono inalterado`), então os campos novos já são aceitos.

## Arquitetura

**`ClientRegistrationModal.jsx`** (novo, em `src/modals/`)

- Props: `{ open, onClose, lead, appUser, db, usersList, tags }` (mesma
  assinatura do `EditLeadModal`, para a troca na ficha ser simétrica).
- Estado inicializado direto do `lead` (sem `useEffect` de re-sync; o modal é
  remontado quando o lead muda), igual ao `EditLeadModal`.
- Salva via `updateDoc` no doc do lead com o patch de `buildClientRegistrationPatch`.
- Reatribuição de consultor só para admin (mesma regra do `EditLeadModal`:
  grava consultantId + consultantName + consultantAuthUid juntos).
- Reusa: `Dialog` (ui), `StyledInput`/`StyledSelect`/`Field`, `Btn`, `TagsInput`
  (extraído do `EditLeadModal` para um módulo compartilhado, ou replicado),
  máscaras de CPF/telefone, e os helpers de `brazilLookups` (`lookupCep`,
  `isCepComplete`, `isValidCpf`, `isCpfComplete`).

**Por que componente separado e não um modo no `EditLeadModal`:** o cadastro do
cliente é bem maior (seis seções). Um arquivo com dois modos fica difícil de ler
e testar. Componente dedicado mantém o `EditLeadModal` enxuto para o lead e cada
um com uma responsabilidade só.

**`buildClientRegistrationPatch(form)`** (novo, em `src/lib/clientRegistration.js`)

- Entrada: o form do modal. Saída: o patch pronto para `updateDoc` (campos +
  `buildLeadSearchFields`). Puro e testável, mantém o modal fino. Segue o padrão
  do repo (regra em lib + teste, como `contracts.js` / `leadDerived.js`).

## Estrutura do modal (cliente)

Seis seções, no layout de `FormSection` do `EditLeadModal`:

1. **Identidade** — Nome*, WhatsApp*, CPF (validação inline), RG, Nascimento,
   Sexo (select), E-mail.
2. **Endereço** — CEP (autopreenche rua/bairro/cidade/UF via ViaCEP no blur),
   Rua, Número, Complemento, Bairro, Cidade, UF.
3. **Contato de emergência** — Nome, Telefone (máscara), Parentesco.
4. **Dados pessoais** — Estado civil (select: Solteiro(a), Casado(a), União
   estável, Divorciado(a), Viúvo(a), Outro), Profissão.
5. **Relacionamento** — Origem, Consultor (só admin reatribui), Etiquetas.
6. **Observação** — texto livre.

No topo, um medidor de completude ("cadastro X% completo") calculado sobre o
conjunto de campos do cliente. Só o Nome trava o salvar.

## Card de leitura na ficha (cliente)

Seção nova "Cadastro" na ficha do cliente (`LeadProfileView`), visível só quando
`isClient`. Mostra, em blocos, os dados preenchidos: identidade (CPF, RG,
nascimento, sexo, e-mail), endereço, contato de emergência, dados pessoais.
Campos vazios não poluem: cada bloco só aparece se tiver algo, com um estado
vazio discreto e um atalho para o lápis quando o cadastro está incompleto.

## Comportamento

- **CEP:** no blur, se completo, busca no ViaCEP e preenche rua/bairro/cidade/UF
  (não toca número/complemento). Mesmo padrão do `GymProfileFields`.
- **CPF:** validação inline (`isValidCpf`) com aviso "CPF inválido"; não bloqueia
  o salvar (campo opcional).
- **Máscaras:** CPF e telefones formatados na digitação.
- **Completude:** medidor recalculado a cada mudança sobre a lista de campos do
  cliente.

## Firestore

Sem índice novo. Sem publicação manual de regras (a regra de update de lead já
aceita campos novos). Nada a fazer no console.

## Testes

- Unitário de `buildClientRegistrationPatch`: máscaras → armazenamento, vazio →
  null, mapas montados/anulados corretamente, campos de busca recomputados,
  reatribuição de consultor só quando admin.
- Manual no preview: abrir ficha de cliente, lápis, preencher as seções, salvar,
  reabrir e conferir persistência; conferir o card de leitura; conferir que a
  ficha de lead segue abrindo o `EditLeadModal` enxuto.

## Entrega

- PR único na branch `claude/customer-registration-redesign-b9f034`.
- Antes de codar: 2 a 3 mockups do modal completo e do card de leitura, para o
  Johnny escolher a direção visual (convenção do repo).
- Verificação no preview e merge só com aprovação do Johnny.
