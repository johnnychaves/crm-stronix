# Foto do cliente — desenho

status: implementado (aprovado no preview em 2026-08-20)
data: 2026-08-20
sistema: Stronilead (React 19 + Vite + Firebase + Vercel)

## Objetivo

Enviar uma foto da pessoa (lead ou cliente) e exibi-la no lugar das iniciais na
ficha, na lista de clientes e na busca global. Antes disso nenhum avatar aceitava
foto e não havia upload de imagem em lugar nenhum do app.

## Decisões

| Decisão | Escolha |
|---|---|
| Onde a foto aparece | Ficha + lista de clientes + busca global (Kanban fora) |
| Onde se envia/troca | **Ícone de câmera no perfil**, no lugar do círculo pequeno de estado |
| Origem da foto | Galeria (seletor de arquivo) **ou** webcam/câmera do notebook |
| Enquadramento | Etapa própria: máscara circular, arrastar e zoom de 1x a 4x |
| Quem tem foto | Qualquer pessoa no cadastro (lead ou cliente) |
| Momento do upload | Imediato — no perfil não existe botão Salvar |
| Armazenamento | Firebase Storage + `photoUrl` no doc do lead |
| Custo de infra | Upload client-side pelo SDK — **nenhuma** função Vercel nova |

Duas decisões mudaram durante a construção, a pedido do Johnny: a foto **não**
fica no modal de cadastro (ficou só no perfil) e o ícone de câmera **substitui**
o dot de estado do avatar.

## Fluxo

1. No perfil, o consultor clica no ícone de câmera do avatar.
2. Abre o menu **Foto do cliente** com duas opções — "Escolher da galeria" e
   "Tirar foto agora" — mais "Remover foto atual" quando já existe foto.
3. **Galeria:** seletor nativo (`accept="image/*"`). **Webcam:** `getUserMedia`
   com preview espelhado e botão Capturar.
4. Qualquer das duas origens cai na etapa **Enquadrar foto**: a imagem arrasta
   sob uma máscara circular e o zoom (slider + botões, 1x–4x) ajusta o
   enquadramento. O que está dentro do círculo é exatamente o que será salvo.
5. "Usar foto" gera um JPEG 512×512, sobe pro Storage e grava no doc do lead.
   Erro de upload mostra o motivo e não altera o cadastro.

## Modelo de dados (doc do lead)

Em `artifacts/{appId}/public/data/stronix_leads/{leadId}`:

- `photoUrl: string | null` — download URL tokenizada (exibição).
- `photoPath: string | null` — caminho do objeto (para deletar).
- `photoUpdatedAt: Timestamp | null` — carimbo da última troca.

`photoUrl` é uma string curta; não infla os reads de lista como um base64
embutido faria — por isso Storage e não imagem dentro do doc.

## Storage — caminho e regras

Caminho (espelha o isolamento por tenant do Firestore, onde `appId` = claim
`tenantId`), nome fixo para que trocar a foto sobrescreva o objeto:

```
tenants/{appId}/leads/{leadId}/avatar.jpg
```

Regras publicadas **manualmente** no console (como as do Firestore):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /tenants/{tenant}/leads/{leadId}/{fileName} {
      allow read: if request.auth != null
                  && request.auth.token.tenantId == tenant;
      allow write: if request.auth != null
                   && request.auth.token.tenantId == tenant
                   && request.resource.size < 2 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
      allow delete: if request.auth != null
                    && request.auth.token.tenantId == tenant;
    }
  }
}
```

Nota de LGPD: a download URL é tokenizada — funciona sem login, mas é impossível
de adivinhar. Suficiente para esta entrega; fechar mais fica para depois.

## Componentes

**`src/lib/leadPhoto.js`** (novo) — validação de entrada (`isSupportedImage`),
caminho (`leadPhotoPath`), upload (`uploadLeadPhoto`) e remoção
(`deleteLeadPhoto`, tolerante a objeto inexistente).

**`src/components/profile/PhotoCaptureMenu.jsx`** (novo) — as duas origens e a
etapa de enquadramento. Devolve sempre um Blob JPEG 512×512 por `onPicked`; quem
grava é o pai. Desliga o stream da webcam ao fechar (senão a luz fica acesa).

**`Avatar`** ganhou `photoUrl` opcional, com fallback pras iniciais no `onError`
(URL quebrada nunca deixa buraco na tela). `RingAvatar`, `StateRingAvatar` e o
`ContractRingAvatar` da lista repassam a prop. `RingAvatar` ganhou também
`onPhotoClick`: com ela, o dot de estado dá lugar ao botão de câmera.

**`ClientRegistrationModal`** — o cabeçalho mostra a foto no lugar do ícone de
lápis quando existe; sem foto, mantém o lápis.

## Permissões

Enviar/trocar/remover exige `canEditLead(appUser, lead)` (dono ou admin) — quem
é read-only continua vendo o dot de estado, sem botão. Exibição é livre para
qualquer membro do tenant.

## Fora de escopo

- Foto no modal de **criação** de lead (o doc ainda não tem id para o caminho).
- Foto no card do **Kanban**.
- Limpeza de objetos órfãos no Storage ao excluir o lead.

## Verificação

796 testes verdes, build de produção limpo e lint sem erros novos. Menu, etapa de
enquadramento e foto no cabeçalho do cadastro conferidos por screenshot no
preview; o zoom foi medido (520px em 1x → 1560px em 3x, razão exata de 3.00).

Limite: a webcam é bloqueada no painel do navegador e o seletor de arquivos é um
diálogo nativo do sistema, então o caminho real de captura foi validado pelo
Johnny no preview — do meu lado o recorte foi exercitado com imagem sintética.
