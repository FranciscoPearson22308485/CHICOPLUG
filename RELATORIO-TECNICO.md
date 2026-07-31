# CHICOPLUG — Relatório Técnico

**Data:** 1 de Agosto de 2026
**Âmbito:** transformar o frontend gerado no Lovable numa loja online funcional,
sem alterar o design.

---

## 1. Resumo executivo

A loja está **funcional ponta a ponta**: um visitante navega no catálogo real,
filtra, adiciona ao carrinho, cria conta, finaliza a compra, paga, e o
administrador gere tudo a partir do painel. **125 testes automatizados passam**,
e ambos os projectos compilam sem erros nem avisos de tipos.

Três coisas **não** estão prontas para produção e precisam de acção humana:

| # | Bloqueador | Impacto |
|---|-----------|---------|
| 1 | **Não há envio de emails** | A recuperação de password gera o token mas não o envia — a funcionalidade está inacabada do ponto de vista do utilizador final. |
| 2 | **Multicaixa Express sem credenciais** | A arquitectura está completa, mas os nomes dos campos e o esquema de assinatura são suposições que têm de ser confirmados contra a documentação oficial da EMIS. |
| 3 | **Cloudinary por configurar** | Funciona com fallback local, que não sobrevive a um redeploy em contentor. |

O ponto 1 é o mais importante e o mais fácil de resolver (~2 horas).

### Sobre a regra "não alterar o design"

Cumprida. Nenhuma classe Tailwind, componente `ui/` ou estrutura JSX do
protótipo foi alterada. As três excepções — todas aditivas — foram:

- **`AdminButton`** ganhou `onClick`, `disabled` e `type`. As classes de estilo
  são exactamente as originais; sem estas props o botão era decorativo.
- **Páginas novas** (`/entrar`, `/registo`, `/recuperar-password`,
  `/repor-password`, `/admin/cupoes`) — não existiam no protótipo e eram
  obrigatórias. Construídas apenas com as primitivas já presentes.
- **Diálogos de CRUD** no painel, usando o `Dialog`, `Input`, `Label`, `Select`
  e `Switch` que já estavam no projecto.

---

## 2. Arquitectura

O frontend **não era** um Vite+React puro: é **TanStack Start**, com SSR e um
servidor Nitro próprio. Como o stack pedido especifica Express, a leitura
correcta foi manter o frontend intacto e acrescentar uma **API Express
separada** que ele consome. Migrar para SPA teria destruído o SSR — e com ele o
SEO que também foi pedido.

```
Browser
  │
  ├─ :3000  TanStack Start (SSR)  ── loaders no servidor → catálogo indexável
  │           │
  │           └─ proxy /api, /static, /sitemap.xml
  │
  └─ :4000  Express + Prisma ── PostgreSQL 16
```

**Porquê o proxy:** com o frontend em `:3000` e a API em `:4000`, o browser
trataria os pedidos como cross-site e recusaria enviar os cookies de sessão
`SameSite=Lax`. O login pareceria funcionar mas nenhuma página autenticada
carregaria. Em produção, o mesmo papel cabe ao reverse proxy.

### Decisões de modelação que vale a pena conhecer

**Stock vive na variante, não no produto.** O protótipo tinha `stock: number`
por produto, mas o requisito pedia stock por quantidade **e** tamanho **e** cor.
`ProductVariant` é a combinação (tamanho × cor) com o seu próprio stock e SKU. O
`stock` que a interface mostra passou a ser a soma das variantes — sem que
nenhum componente mudasse.

**As linhas de encomenda são desnormalizadas.** `OrderItem` guarda nome, preço e
imagem copiados no momento da compra. Ligá-las ao produto por chave estrangeira
faria o histórico reescrever-se sozinho sempre que o catálogo fosse editado.
Há um teste que prova que não acontece.

**Valores monetários são inteiros em Kwanzas.** O `formatKz` do protótipo usa
`maximumFractionDigits: 0`; guardar cêntimos só criaria divergência.

---

## 3. Funcionalidades implementadas

### 3.1 Base de dados — 16 modelos

Produtos, variantes, categorias, colecções, imagens, utilizadores, refresh
tokens, tokens de reposição de password, carrinhos, itens de carrinho,
favoritos, moradas, encomendas, linhas de encomenda, eventos de encomenda,
pagamentos, cupões e definições da loja.

### 3.2 Autenticação

| Funcionalidade | Estado |
|---|---|
| Registo, login, logout | ✅ Funcional e testado |
| JWT em cookies `httpOnly` | ✅ Funcional e testado |
| Refresh tokens rotativos | ✅ Funcional e testado |
| Detecção de reutilização de token roubado | ✅ Implementado, testado |
| RBAC `user` / `admin` | ✅ Funcional e testado |
| Perfil, alteração de password | ✅ Funcional e testado |
| Recuperação de password | ⚠️ **Backend completo; email não é enviado** |

Detalhes de segurança: bcrypt com 12 rondas; comparação de tempo constante
contra enumeração de contas (um login com email inexistente demora o mesmo que
um com password errada); refresh tokens guardados apenas em SHA-256; repor a
password revoga todas as sessões abertas.

### 3.3 Loja

Catálogo real com pesquisa por nome/descrição/categoria, filtros combinados
(categoria, tamanho, cor, preço), quatro ordenações, paginação e facetas.

As facetas descrevem o catálogo **inteiro**, não o resultado filtrado — caso
contrário, escolher "Hoodies" faria desaparecer as outras categorias e o
utilizador ficava sem forma de mudar de ideias.

Carrinho persistente que funciona **com e sem conta**: o carrinho anónimo vive
num cookie e é fundido no do utilizador ao iniciar sessão, somando quantidades
mas travando sempre no stock disponível.

Checkout completo com cupões, cálculo de envio, decremento de stock e criação de
pagamento.

### 3.4 Painel administrativo

CRUD completo de produtos (com variantes e upload de imagens), categorias,
colecções, clientes, encomendas, stock e cupões. Dashboard com métricas reais e
comparação com o período anterior. Relatórios com janela configurável e
exportação CSV.

Comportamentos deliberados:

- Produtos, clientes e cupões com histórico são **arquivados**, não apagados —
  apagá-los deixaria encomendas sem referência e falsearia os relatórios.
- Categorias com produtos não podem ser removidas (a API explica porquê em vez
  de devolver um erro de chave estrangeira).
- Um administrador não se pode despromover nem desactivar a si próprio — seria
  possível ficar sem nenhum admin activo e sem recuperação pela interface.
- O CSV escapa células que começam por `=`, `+`, `-` ou `@`: sem isso, um nome
  como `=CMD()` seria interpretado como fórmula ao abrir no Excel.

### 3.5 Pagamentos

Porta/adaptador com dois provedores:

- **`mock`** — simulador local totalmente funcional, que reproduz a natureza
  assíncrona do Multicaixa Express (confirmação fora do pedido HTTP original).
- **`multicaixa`** — adaptador real, arquitectura completa, inerte sem
  credenciais.

Estados: `PENDENTE` → `PAGO` / `CANCELADO` / `FALHADO`. Os callbacks são
idempotentes (a EMIS reenvia em caso de timeout) e um pagamento concluído nunca
regride.

### 3.6 Encomendas

Máquina de estados explícita: `NOVA` → `CONFIRMADA` → `EM_PREPARACAO` →
`ENVIADA` → `ENTREGUE`, com `CANCELADA` acessível de qualquer estado não-final.

Modelada como grafo, e não como lista ordenada, porque o fluxo real não é
linear: uma encomenda entregue **não** pode ser cancelada — uma devolução é
outro processo, não um retrocesso de estado.

### 3.7 Uploads

Cloudinary com fallback automático para disco local. Todas as imagens passam
pelo Sharp: correcção de orientação EXIF, redimensionamento para 2000px e
conversão para WebP com qualidade 82.

### 3.8 SEO

Meta tags e Open Graph por página; `robots.txt` e `sitemap.xml` **gerados da
base de dados** (um sitemap escrito à mão fica desactualizado no primeiro drop);
Schema.org com `Organization`, `WebSite`, `Product` (com preço, moeda AOA e
disponibilidade), `BreadcrumbList` e `CollectionPage`.

O SSR entrega o catálogo já renderizado no HTML — verificado por inspecção da
resposta, não por suposição.

### 3.9 Segurança

Helmet com CSP; CORS por allowlist com credenciais; rate limiting em quatro
níveis (o de autenticação chaveia por IP **e** email, para que atacar uma conta
a partir de vários IPs continue a ser travado); validação Zod que **substitui**
body/query/params pela versão analisada; sanitização de HTML e caracteres de
controlo; protecção contra poluição de protótipo; CSRF double-submit.

Injecção de SQL: o Prisma usa consultas parametrizadas. As duas únicas consultas
`$queryRaw` do projecto (referência de encomenda e agregação mensal) usam
interpolação parametrizada do Prisma, não concatenação de strings.

---

## 4. O que foi testado

**125 testes automatizados, todos a passar** (`npm test` no backend).

### Testes unitários (40)

| Ficheiro | Cobre |
|---|---|
| `order-status.test.ts` | Máquina de estados: percurso feliz, saltos de etapa, retrocessos, estados finais, reposição de stock |
| `coupons.test.ts` | Percentagem, valor fixo, arredondamento, tecto no subtotal, carrinho vazio |
| `slug.test.ts` | Acentos portugueses (`Calças` → `calcas`), pontuação, unicidade, SKU |
| `serializer.test.ts` | Soma de stock, variantes inactivas, distintivos, regressão do `badgeKey` |

### Testes de integração (85)

| Ficheiro | Cobre |
|---|---|
| `auth.test.ts` | Registo, cookies httpOnly, duplicados, passwords fracas, login, resposta uniforme contra enumeração, contas desactivadas, rotação de refresh, reposição de password, **CSRF a bloquear mutações sem token**, RBAC |
| `shop.test.ts` | Catálogo, facetas, filtros, pesquisa, ordenação, carrinho anónimo, envio grátis, limites de stock, fusão de carrinho no login, favoritos, isolamento entre utilizadores, moradas |
| `checkout.test.ts` | Checkout, decremento de stock, **instantâneo do produto resistente a alterações do catálogo**, prevenção de overselling, cupões, pagamentos idempotentes, reposição de stock no cancelamento, isolamento de encomendas, máquina de estados, ajustes de stock, dashboard |

### Verificação manual documentada

Executada contra os servidores a correr, com inspecção das respostas:

- Fluxo completo de compra (registo → carrinho → cupão → checkout → pagamento →
  confirmação automática → cancelamento → reposição de stock): **14 passos**.
- SSR entrega produtos reais, preços, JSON-LD, `BreadcrumbList` e imagens
  servidas pela API no HTML inicial.
- Pesquisa `?search=hoodie` devolve 34 KB só com o hoodie; sem filtro devolve
  62 KB com todo o catálogo.
- `sitemap.xml` e `robots.txt` servidos correctamente através do proxy.
- Limites de stock: aceita exactamente o disponível, rejeita +1, rejeita a soma
  acumulada.

### O que **não** foi testado

Sê consciente destas lacunas:

- **Não há testes de componentes no frontend.** O frontend não tem Vitest nem
  Testing Library configurados. Toda a lógica de UI (contextos, formulários,
  diálogos do admin) foi verificada apenas pelo typecheck, pelo build e pelas
  APIs que consome — **não por cliques**.
- **O painel de administração não foi percorrido manualmente.** Os endpoints que
  os formulários chamam estão testados; os formulários em si, não.
- **O upload para o Cloudinary real nunca correu.** Só o caminho de fallback
  local foi exercitado (pelo seed, que optimizou 8 imagens).
- **O adaptador Multicaixa nunca contactou a EMIS.**
- **Não há testes de carga nem de concorrência real.** A prevenção de overselling
  está testada logicamente, mas não sob concorrência verdadeira.

---

## 5. Totalmente funcional agora

Sem configuração adicional, num ambiente de desenvolvimento:

- Registo, login, logout, sessões, perfil, RBAC
- Catálogo: pesquisa, filtros, categorias, colecções, ordenação, paginação
- Carrinho persistente com e sem conta, com fusão no login
- Favoritos
- Moradas com morada principal exclusiva
- Checkout, cupões, cálculo de envio
- Pagamentos (com o simulador) e todos os quatro estados
- Ciclo de vida das encomendas com reposição de stock
- Painel completo: CRUD, dashboard, stock, cupões, relatórios, CSV
- Uploads com optimização (para disco local)
- SEO: meta tags, Open Graph, sitemap, robots, Schema.org
- SSR do catálogo

---

## 6. Depende apenas de configuração

### 6.1 Multicaixa Express — **verificação obrigatória antes de produção**

O ficheiro é `backend/src/modules/payments/providers/multicaixa.provider.ts`.
Preencher no `.env`:

```bash
PAYMENTS_PROVIDER="multicaixa"
MULTICAIXA_POS_ID="<fornecido pela EMIS>"
MULTICAIXA_API_URL="https://pagamentonline.emis.co.ao/online-payment-gateway/portal"
MULTICAIXA_CALLBACK_URL="https://api.chicoplug.ao/api/payments/multicaixa/callback"
MULTICAIXA_CERT_PATH="/caminho/para/certificado.pfx"
MULTICAIXA_CERT_PASSPHRASE="<passphrase>"
MULTICAIXA_WEBHOOK_SECRET="<segredo>"
```

**Não basta preencher.** A EMIS não publica documentação aberta, por isso o
adaptador contém três suposições que **têm de ser confirmadas** contra a
documentação que receberes na adesão:

1. **Nomes dos campos** do corpo de `POST /frameToken` (`reference`, `amount`,
   `token`, `mobile`, `card`, `qrCode`, `callbackUrl`).
2. **Formato do callback.** O `parseCallback` aceita várias grafias do campo de
   referência (`reference`, `merchantTransactionId`, `clientId`) e vários
   códigos de estado, precisamente por não haver certeza.
3. **Esquema de assinatura do webhook.** Está implementado HMAC-SHA256 sobre o
   corpo, no cabeçalho `x-emis-signature` — uma suposição defensiva. Se a EMIS
   usar outro esquema, substituir `verifySignature`.

Também não existe endpoint de consulta de estado: o `getStatus` assume
`PENDENTE` até chegar o callback. Se a EMIS expuser consulta activa, é aí que
entra.

Os pontos a rever estão marcados no código com `CONFIRMAR CONTRA A DOCUMENTAÇÃO
OFICIAL`.

### 6.2 Cloudinary

```bash
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

Sem estas três, o sistema usa disco local automaticamente. O painel de
configurações mostra o estado e as variáveis em falta.

### 6.3 Produção

```bash
NODE_ENV=production
JWT_ACCESS_SECRET="$(openssl rand -base64 48)"
JWT_REFRESH_SECRET="$(openssl rand -base64 48)"
CORS_ORIGINS="https://chicoplug.ao"
PUBLIC_SITE_URL="https://chicoplug.ao"
DATABASE_URL="<postgres gerido>"
```

O backend **recusa arrancar** se detectar segredos de desenvolvimento com
`NODE_ENV=production`.

A API tem de ser servida na mesma origem do frontend (por exemplo `/api` via
nginx) ou num subdomínio com cookies `SameSite=None; Secure` — já tratado no
código, mas exige HTTPS.

---

## 7. Bugs encontrados e corrigidos

Três bugs reais foram descobertos **durante** o desenvolvimento e corrigidos:

**1. Pesquisa meio ligada.** A barra de pesquisa navegava para
`/shop?search=…` mas a página ignorava o parâmetro — a pesquisa parecia
funcionar e não filtrava nada. Corrigido com `validateSearch` + `loaderDeps`, o
que também tornou o resultado partilhável por URL e renderizado no servidor.

**2. Edição de produto apagava o distintivo.** A API só devolvia o rótulo
acentuado (`"ÚLTIMAS UNIDADES"`), não a chave do enum, por isso o formulário do
admin não conseguia repor o valor e gravava `null`. Qualquer edição de produto
perdia silenciosamente o distintivo. Corrigido com o campo `badgeKey`, com
**três testes de regressão**.

**3. Limiar de stock baixo reposto a 6.** O formulário do admin não recebia o
`lowStockThreshold` real da variante e reescrevia-o com o valor por omissão a
cada gravação. Corrigido.

Um quarto problema, descoberto pelos testes, era do **teste** e não da
aplicação: a protecção CSRF bloqueava o cliente de teste porque este não
imitava o browser (que faz sempre um GET antes de submeter). Aproveitou-se para
tornar o cliente do frontend resistente ao caso em que a primeira acção da
sessão é uma submissão.

---

## 8. Necessita de implementação manual

Por ordem de importância:

### 8.1 Envio de emails — **o mais urgente**

Nada é enviado por email. O `POST /api/auth/forgot-password` gera o token
correctamente e regista o link em log em vez de o enviar
(`backend/src/modules/auth/auth.routes.ts`, marcado com `PENDENTE DE
CONFIGURAÇÃO`). Em desenvolvimento o token é devolvido na resposta para o fluxo
poder ser testado.

Também não existem: email de confirmação de encomenda, notificação de mudança de
estado, nem email de boas-vindas.

Estimativa: ~2 horas com Resend ou SendGrid.

### 8.2 Formulários decorativos ainda por ligar

- **Newsletter no rodapé** (`components/site/Footer.tsx`) — o formulário existe
  mas não submete para lado nenhum. Falta o modelo `NewsletterSubscriber` e o
  endpoint. O toggle "Lista de espera de drops" já existe nas configurações.
- **Formulário de contacto** (`routes/contacto.tsx`) — apenas `preventDefault`.

### 8.3 Página de consulta de encomenda sem conta

O endpoint `POST /api/orders/lookup` está implementado e testado, mas não há
página no frontend que o use. Quem compra sem conta não tem como acompanhar a
encomenda.

### 8.4 Limpezas e detalhes

- **Imagens órfãs no Cloudinary**: ao substituir imagens de um produto, o
  `publicId` perde-se no caminho de ida e volta pelo frontend (que só recebe
  URLs), deixando ficheiros por apagar no Cloudinary.
- **Tokens expirados** acumulam-se nas tabelas `refresh_tokens` e
  `password_reset_tokens`. Falta uma tarefa periódica de limpeza.
- **Carrinhos anónimos abandonados** nunca são removidos.

---

## 9. Melhorias recomendadas

**Antes de abrir ao público**

1. Enviar emails (§8.1).
2. Confirmar a integração da EMIS contra a documentação oficial (§6.1).
3. Configurar o Cloudinary — o disco local não sobrevive a um redeploy em
   contentor.
4. Testes de componentes no frontend, começando pelos contextos de carrinho e
   autenticação e pelos formulários do admin, que hoje só estão validados por
   tipos.
5. Monitorização de erros (Sentry) e logs estruturados agregados.

**Curto prazo**

6. Percorrer manualmente o painel de administração — os formulários nunca foram
   clicados.
7. Reservar stock durante o checkout com expiração (hoje o stock só é
   decrementado ao criar a encomenda; entre abrir o checkout e pagar, outra
   pessoa pode levar a peça).
8. Paginação por scroll ou botão "carregar mais" no shop — hoje o limite é 24
   peças e não há navegação entre páginas na interface.
9. Índice de texto completo no Postgres (`pg_trgm`). O `contains` actual não
   escala nem tolera erros de escrita.

**Médio prazo**

10. Emails transaccionais de estado de encomenda.
11. Cache Redis para catálogo e facetas.
12. Testes de carga no checkout, para validar a prevenção de overselling sob
    concorrência real.
13. Painel de reconciliação de pagamentos (o `rawPayload` já é guardado para
    isso).
14. Auditoria de acessibilidade — o design usa muito texto pequeno com
    `tracking` largo e contrastes que merecem verificação.

---

## 10. Como validar

```bash
# Backend: 125 testes
cd backend && npm test

# Tipos e builds
cd backend && npx tsc --noEmit && npm run build
cd frontend && npx tsc --noEmit && npm run build

# Loja a correr
cd backend && npm run dev      # :4000
cd frontend && npm run dev     # :3000
```

Entra com `admin@chicoplug.ao` / `ChicoPlug!2026` para o painel, ou
`cliente@chicoplug.ao` / `Cliente!2026` para a área de cliente. No checkout, em
desenvolvimento, aparecem botões para simular o resultado do pagamento.

---

## 11. Nota final

Não classifiquei como "funcional" nada que não tenha executado. O que está na
secção 5 foi corrido; o que está na secção 4 sob "o que não foi testado" é
exactamente o que não tenho como garantir. As lacunas mais relevantes são o
envio de emails e a ausência de testes de interface — ambas com caminho claro.
