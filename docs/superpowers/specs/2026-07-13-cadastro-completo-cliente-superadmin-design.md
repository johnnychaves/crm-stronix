# Cadastro completo de clientes no superadmin

status: ativo
data: 2026-07-13

## Problema

No superadmin, o formulário "Nova organização" cria o cliente com apenas 7 campos
(nome da org, slug, nome/e-mail/senha do admin, plano, dias de teste). Já existe,
dentro da plataforma, uma tela de "Perfil da academia" muito mais completa
(CNPJ, razão social, nome fantasia, endereço completo, responsável com CPF e
nascimento, WhatsApp, telefone, e-mail comercial).

O objetivo é deixar o cadastro do superadmin **completo, com paridade exata** aos
campos do Perfil da academia, tanto na criação quanto na edição posterior de cada
cliente.

## Escopo

Nesta entrega (parte 1):

- Formulário "Nova organização" passa a coletar todos os campos do Perfil da academia.
- Modal "Gerenciar" de cada cliente ganha uma aba "Perfil" para editar os mesmos campos.

Fora de escopo (parte 2, PR futuro): link self-service onde o próprio cliente
preenche tudo e ganha acesso. Decisão de produto já tomada para quando for feito:
**o acesso libera só após o pagamento da 1ª fatura** (reaproveita a `TrialActivationScreen`
+ webhook do Asaas que já existem). Esta parte 1 deixa o `tenant.profile` populado,
o que é pré-requisito natural dessa etapa.

## Os campos (fonte da verdade)

Espelham 1:1 o `EMPTY` de `GymProfileTab.jsx` e o `PROFILE_MAX` de `api/_profile.js`:

| Bloco | Campos | Onde grava |
|---|---|---|
| Identidade & fiscal | `cnpjCpf`, `legalName`, `tradeName` (opcional) | `tenant.profile` |
| Endereço | `cep`, `street`, `number`, `complement` (opcional), `neighborhood`, `city`, `state` | `tenant.profile` (menos `city`/`state`) + `tenant.settings.{city,state}` |
| Contato & responsável | `responsibleName`, `responsibleCpf`, `responsibleBirth`, `whatsapp`, `phone`, `email` | `tenant.profile` (menos `whatsapp`) + `tenant.responsiblePhone` (whatsapp) |

Comportamentos que precisam vir junto (paridade exata):

- CNPJ completo → busca razão social + nome fantasia na BrasilAPI (`lookupCnpj`).
- CEP completo → preenche rua/bairro/cidade/UF na ViaCEP (`lookupCep`).
- CPF do responsável validado localmente (`isValidCpf`), com erro inline.

## Arquitetura

### Componente compartilhado (o núcleo)

Criar `src/components/profile/GymProfileFields.jsx`:

- Renderiza os 3 blocos (Identidade & fiscal, Contato & responsável, Endereço).
- Dono dos lookups (CNPJ/CEP) e da validação de CPF.
- Fala com o pai só por `value` (objeto com os ~16 campos) + `onChange(patch)`.
- É o espelho no front do que `_profile.js` já é no back: uma fonte única de campos.
- Props para flexibilizar o container: `wrapInCards` (bool) para decidir se os
  blocos vêm dentro de `SettingsCard` (Perfil da academia) ou como grids soltos
  com título simples (formulário de criação / modal, que já têm seu próprio card).
- Expõe (via callback opcional `onValidityChange`) se o CPF está inválido, para o
  pai bloquear o "salvar".

`GymProfileTab.jsx` é refatorado para consumir o novo componente, mantendo seu
cabeçalho de "carteira" + anel de completude. Comportamento visível idêntico ao de hoje.

### Formulário "Nova organização" (`SuperAdminView.jsx`)

- Mantém o bloco atual como **"Conta & acesso"** (campos obrigatórios: nome, slug,
  admin nome/e-mail/senha, plano, trial).
- Abaixo, uma **seção recolhível "Dados da empresa"** (fechada por padrão) com
  `GymProfileFields`. Todos os campos de empresa são **opcionais** na criação
  (cria rápido agora, completa depois), igual ao tratamento do Perfil da academia.
- `form` state ganha os campos de perfil; `submit()` envia `profile` (+ city/state
  e whatsapp já mapeados) para `/api/provision-tenant`.
- Se o CPF do responsável estiver preenchido e inválido, bloqueia o submit com aviso.

### Modal "Gerenciar" (`TenantManageModal.jsx`)

- Nova sub-aba **"Perfil"** entre "Configurações" e "Ações", hospedando `GymProfileFields`.
- Pré-carrega do tenant aberto (`t.profile`, `t.settings.city/state`, `t.responsiblePhone`).
- Salva via `onPatch({ profile, settings:{city,state}, responsiblePhone })` que já
  cai em `tenant-status.js` (sem mudança de backend aqui).
- **Cidade/UF saem da aba "Configurações"** e passam a viver no bloco Endereço da aba
  "Perfil" (sem duplicar). "Configurações" mantém: nome da organização, logo (URL) e
  o aviso do slug imutável.

### Backend (única mudança real de API)

`api/provision-tenant.js`:

- Passa a aceitar `profile` no body do POST.
- Saneia com `sanitizeProfile` (import de `./_profile.js`) e grava em `tenant.profile`
  no `.create()` do tenant (só quando houver algo).
- `city`, `state`, `responsiblePhone` já são aceitos hoje; continuam mapeando para
  `settings` e top-level. WhatsApp do form entra como `responsiblePhone`.
- Campos de perfil são opcionais: ausência não quebra o provisionamento.

`api/tenant-status.js` e `api/asaas.js`: **sem mudança** (já aceitam `profile` via
`sanitizeProfile`).

## Isolamento e limites

- `GymProfileFields` tem um propósito único (coletar/validar o perfil da academia)
  e é testável isolado. Três telas passam a depender dele em vez de duplicar lógica.
- Sem função Serverless nova (o limite de 12 do Vercel Hobby continua respeitado):
  a criação já usa `provision-tenant`, a edição já usa `tenant-status`.

## Verificação

1. Build/lint (`npm run build` ou checagem via `@babel/parser` se faltar dep — ver
   memória do worktree).
2. Preview ao vivo (`npm run dev`, porta 5180):
   - Criar org com "Dados da empresa" preenchidos → confirmar persistência.
   - "Entrar como" a org → abrir "Perfil da academia" e conferir que os campos
     aparecem preenchidos (round-trip criação → perfil do cliente).
   - No superadmin, "Gerenciar" → aba "Perfil" → editar e salvar → reabrir e conferir.
   - CNPJ auto-preenche razão social; CEP auto-preenche endereço; CPF inválido bloqueia.
3. Confirmar que o `GymProfileTab` do cliente continua idêntico ao de antes do refactor.

## Riscos

- Refatorar `GymProfileTab` pode regredir a tela do cliente. Mitigação: extrair sem
  mudar layout/labels; conferir a tela no preview antes de fechar.
- Paridade de gravação: o mapeamento city/state → settings e whatsapp → responsiblePhone
  precisa ser idêntico nos três caminhos (criação, edição superadmin, self-service do
  cliente) para não divergir. `sanitizeProfile` já garante isso para os campos de `profile`.
