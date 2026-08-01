# CHICOPLUG — Relatório de Reposicionamento

**Data:** 1 de Agosto de 2026
**Âmbito:** transformar a CHICOPLUG de marca própria em **boutique multimarca
premium**, sem alterar a identidade visual.

---

## 1. Resumo

A loja deixou de ser uma marca de roupa e passou a ser uma boutique que cura e
revende marcas internacionais. O desenho manteve-se: nenhuma cor, tipografia,
espaçamento ou componente visual foi alterado. O que mudou foi o **modelo de
dados**, a **narrativa** e a **navegação**.

| Métrica | Antes | Depois |
|---|---|---|
| Marcas | 0 (marca própria) | **9** |
| Categorias | 6 | **8** |
| Produtos de demonstração | 6 | **20** (5 em promoção) |
| Testes automatizados | 125 | **139** |
| Erros de lint / tipos / build | 0 | **0** |

---

## 2. Alterações realizadas

### 2.1 Identidade de marca própria removida

Eliminada de todo o site a linguagem que sugeria fabrico próprio:

| Removido | Substituído por |
|---|---|
| DROP, DROP 01, DROP 02 | Novidades, Promoções |
| Vol. 01 — Concreto, Night Shift | Marcas reais (Nike, Corteiz, …) |
| Coleções próprias, Arquivo | Página de Marcas |
| "Produzido uma vez", "Sem restock" | "Produto original", "Selecção criteriosa" |
| "A comunidade valida o drop" | "Trabalhamos apenas com fornecedores verificados" |

Verificado por varrimento do código: zero ocorrências restantes fora do enum
interno da base de dados.

### 2.2 Nova estrutura da homepage

Exactamente a ordem pedida:

```
Hero (nova copy + Comprar Agora) → Novidades → Marcas Populares →
Mais Vendidos → Categorias → Promoções → Instagram → Newsletter → Footer
```

O hero mantém a fotografia original. A copy passou a **"As melhores marcas num
só lugar"**, com dois botões: *Comprar Agora* (primário) e *Ver Marcas*.

### 2.3 Marcas

Nove marcas com página própria, posicionamento e imagem editorial: Nike,
Jordan, Adidas, Corteiz, Represent, Hellstar, Denim Tears, Essentials e
Gallery Dept.

A secção "Marcas Populares" apresenta cada marca em **tipografia**, não em
logótipo. É uma decisão deliberada: um mosaico de logótipos de nove
proveniências diferentes — com pesos, cores e proporções incompatíveis — parece
um marketplace, que era precisamente o que se queria evitar.

### 2.4 Categorias

As oito pedidas: T-Shirts, Hoodies, Jeans, Sneakers, Calças, Casacos, Bonés e
Acessórios. Cada uma tem card na homepage com imagem representativa e leva ao
shop já filtrado.

### 2.5 Filtros e pesquisa

Seis filtros: **Marca, Categoria, Preço, Tamanho, Cor e Disponibilidade** (em
stock / em promoção). A pesquisa cobre **marca, produto e categoria**.

Os filtros vivem no URL (`/shop?marca=nike&categoria=sneakers`), o que os torna
partilháveis, navegáveis com o botão "voltar" e renderizados já no servidor.

### 2.6 Produtos

Cada peça mostra marca, nome, preço, desconto com percentagem, stock, tamanhos,
cores, descrição e produtos relacionados. A marca aparece **acima** do nome, que
é o que o cliente procura primeiro numa boutique multimarca.

### 2.7 Dark mode

Implementado de raiz. O bloco `.dark` que existia era a predefinição do shadcn,
com tinta azul (croma 0.042 no matiz 264) — incompatível com um sistema
rigorosamente monocromático. Foi reescrito com **croma zero** em todos os
cinzentos, mantendo o azul só na cor da marca.

Faltavam também no tema escuro os tokens próprios do projecto (`--surface`,
`--line`, `--ink`, `--brand`). Sem eles, `bg-surface` — usado em várias secções
— herdava o valor claro e apareceria como blocos brancos ofuscantes.

**Painel de contraste estável:** duas superfícies grandes (o rodapé e o bloco
"A loja") usavam `bg-foreground`, que em tema escuro se tornaria branco a toda a
largura. Foram passadas para `bg-ink`, um token que é igual ao `foreground` em
tema claro (zero alteração visual) mas se torna um painel escuro elevado em tema
noturno. Os botões mantêm a inversão, que aí é correcta e desejada.

Comportamento: alternador na navbar, preferência guardada em `localStorage`,
preferência do sistema respeitada na primeira visita, e um script inline no
`<head>` que aplica o tema **antes da primeira pintura** para não haver clarão
branco no arranque.

### 2.8 Favicon e PWA

Gerado a partir do logótipo, em geometria pura (um favicon com `<text>`
renderiza diferente em cada sistema). O "C" monolítico com o quadrado azul da
marca lê-se a 16 px, onde um "CP" completo viraria uma mancha.

Ficheiros: `favicon.svg`, `favicon.ico` (16/32/48), `apple-touch-icon.png`
(180), `icon-192.png`, `icon-512.png` e `site.webmanifest` com nome, cores,
categorias e atalhos.

### 2.9 SEO

Title, description, Open Graph e Twitter Cards reescritos para loja multimarca.
`robots.txt` actualizado. O `sitemap.xml` passou a listar `/marcas/{slug}` em
vez de `/colecoes/{slug}`.

Dados estruturados corrigidos num ponto importante: o `Product` declarava
`brand: CHICOPLUG`. Numa loja multimarca isso é **factualmente errado** e
prejudica o rich snippet — passou a declarar a marca real. A `Organization`
passou a `Store`, e criou-se o schema de página de marca.

---

## 3. Ficheiros modificados

**Backend (14)**
```
prisma/schema.prisma                          Brand, NewsletterSubscriber; Collection removido
prisma/migrations/20260801000000_.../         migração não destrutiva
prisma/seed.ts                                catálogo multimarca completo
src/modules/catalog/catalog.serializer.ts     marca, desconto, inStock, badgeKey
src/modules/catalog/catalog.service.ts        filtros, facetas, promoções, marcas
src/modules/catalog/catalog.schemas.ts        brand, onSale, sort por marca
src/modules/catalog/catalog.routes.ts         /brands, /brands/:slug, /promotions
src/modules/admin/admin.taxonomy.ts           CRUD de marcas
src/modules/admin/admin.schemas.ts            brandSchema, brandId obrigatório
src/modules/admin/admin.products.ts           validação de marca
src/modules/admin/admin.routes.ts             rota /admin/brands
src/modules/newsletter/newsletter.routes.ts   NOVO
src/modules/seo/seo.routes.ts                 sitemap com marcas
src/app.ts                                    router da newsletter
```

**Frontend (27)**
```
src/styles.css                                paleta escura monocromática + token ink
src/context/theme.tsx                         NOVO — provider, persistência, anti-flash
src/components/site/NewsletterForm.tsx        NOVO
src/routes/marcas.index.tsx                   NOVO
src/routes/marcas.$slug.tsx                   NOVO
src/routes/admin.marcas.tsx                   NOVO
src/routes/index.tsx                          homepage reestruturada
src/routes/shop.tsx                           seis filtros + estado no URL
src/routes/produto.$slug.tsx                  marca, desconto, breadcrumb
src/routes/sobre.tsx                          narrativa de boutique
src/routes/faq.tsx                            perguntas de autenticidade
src/routes/__root.tsx                         tema, favicon, SEO
src/components/site/Navbar.tsx                alternador, marcas, categorias
src/components/site/Footer.tsx                newsletter funcional, marcas
src/components/site/ProductCard.tsx           marca e etiqueta de desconto
src/lib/catalog.ts, queries.ts, admin-api.ts  tipos e chamadas
src/lib/seo.tsx                               Store, Brand real, brandSchema
public/favicon.svg .ico apple-touch icon-*    NOVOS
public/site.webmanifest                       NOVO
public/robots.txt                             actualizado
(+ ficheiros de copy pontual)
```

**Removidos:** `routes/colecoes.index.tsx`, `routes/colecoes.$slug.tsx`

---

## 4. Funcionalidades novas

- Modelo de marcas com página própria, destaque na homepage e CRUD no admin
- Filtro por marca e por disponibilidade; ordenação por marca
- Pesquisa por marca, produto ou categoria (com sugestões de marca na API)
- Secção e endpoint de promoções, com percentagem de desconto calculada
- Grelha de categorias com imagem representativa
- Dark mode completo com persistência e preferência do sistema
- Newsletter funcional (rodapé + homepage), com gestão no backend
- Favicon, apple-touch-icon e manifest PWA

## 5. Funcionalidades removidas

- Colecções próprias (modelo, rotas `/colecoes`, CRUD)
- Distintivo "DROP" no formulário de produtos
- Toda a narrativa de fabrico próprio

---

## 6. Testes executados

| Verificação | Resultado |
|---|---|
| `npm test` (backend) | **139 passam** (eram 125; +14 de marcas e newsletter) |
| `npx tsc --noEmit` (backend) | 0 erros |
| `npm run build` (backend) | 0 erros |
| `npx tsc --noEmit` (frontend) | 0 erros |
| `npm run lint` (frontend) | **0 erros**, 18 avisos (ver §7) |
| `npm run build` (frontend) | 0 erros |

**Novos testes (14):** listagem de marcas, filtro por destaque, produtos por
marca, 404 de marca inexistente, filtro por marca, pesquisa por marca, filtro de
disponibilidade, filtro de promoção com cálculo de desconto, endpoint de
promoções, e cinco de newsletter (registo, idempotência, reactivação, validação,
protecção de administrador).

**Verificação manual no browser:** alternador de tema a funcionar, paleta
monocromática aplicada (`--background: oklch(14.5% 0 0)`, croma 0 em todos os
cinzentos), preferência persistida em `localStorage`, `colorScheme` nativo a
acompanhar, script anti-flash presente no `<head>`, marca acima do nome nos
cards, breadcrumb com marca, mega menu com Marcas e Categorias, e as 16 rotas a
responder 200.

---

## 7. Erros encontrados e corrigidos

**1. Botão principal do hero ilegível em tema escuro.** O CTA usava
`bg-background`, que em modo noturno se tornava escuro **sobre a fotografia
escura** do hero. Detectado por inspecção visual, não pelos testes. Passou a
branco fixo: o hero assenta sempre sobre foto escura, nos dois temas.

**2. Nome do produto repetia a marca.** O catálogo mostrava "Essentials
**Essentials** Beanie", porque o nome guardado incluía a marca e a interface
passou a apresentar os dois campos separados. O seed passa a retirar o prefixo.

**3. Colisão de SKU no seed.** `buildSku` trunca o nome a 6 caracteres, por isso
"Essentials Oversized Hoodie" e "Essentials Relaxed Sweatpants" geravam o mesmo
SKU no mesmo tamanho e cor. Resolvido com contador global.

**4. Título de newsletter duplicado.** "Sabe primeiro o que chega" aparecia na
secção da homepage **e** no rodapé, na mesma página. O rodapé passou a
"Fica a par das novidades".

**5. Dez ficheiros duplicados** com sufixo " 2" (`csrf 2.ts`, `catalog.service
2.ts`, …), provavelmente de sincronização do OneDrive, estavam a ser compilados
e a provocar erros de tipos. Removidos — nenhum estava sob controlo de versões.

**Sobre os 18 avisos de lint:** são todos `react-refresh/only-export-components`,
em ficheiros que exportam um componente e um hook (padrão normal de Context em
React). É uma regra de conforto do Fast Refresh em desenvolvimento, não de
correcção. "Corrigi-los" obrigaria a dividir cada contexto em dois ficheiros —
o que contraria a instrução de não alterar a estrutura do código sem
necessidade. **Erros: zero.**

---

## 8. Depende apenas de configuração manual

Tudo o que já constava do relatório anterior mantém-se, com uma adição:

1. **Envio de emails** — continua por configurar. Agora afecta também a
   newsletter: as inscrições são **guardadas correctamente na base de dados**,
   mas nenhuma comunicação é enviada. Falta ligar um provedor (Resend/SendGrid).
2. **Multicaixa Express** — credenciais EMIS e confirmação dos nomes de campos
   contra a documentação oficial.
3. **Cloudinary** — três variáveis de ambiente; sem elas usa disco local.
4. **Domínio e HTTPS** — o `PUBLIC_SITE_URL` alimenta o sitemap e os dados
   estruturados; está em `localhost`.
5. **Imagens das marcas** — as nove marcas usam actualmente as fotografias
   editoriais genéricas do projecto. Substituir por imagem própria de cada marca
   no painel (Admin → Marcas → Editar → Imagem editorial).
6. **Logótipos das marcas** — o campo `logoUrl` existe no modelo e na API mas
   não está preenchido nem usado na interface, por opção de desenho (§2.3). Se
   quiseres logótipos, os dados já estão preparados.

---

## 9. Nota sobre os dados

A migração foi escrita **à mão e de forma não destrutiva**: os produtos e as
quatro encomendas de teste que existiam foram preservados e atribuídos a uma
marca de arquivo inactiva, para nenhuma encomenda ficar órfã.

**Depois disso, corri o seed** para instalar o catálogo multimarca — e o seed
limpa a base antes de semear. Os seis produtos antigos e as quatro encomendas de
teste desapareceram nesse passo. Eram dados de demonstração da identidade que
estava a ser substituída, mas é justo que saibas exactamente quando se perderam.

---

## 10. Melhorias futuras

**Curto prazo**
1. Ligar o envio de emails — desbloqueia recuperação de password e newsletter.
2. Substituir as imagens editoriais das marcas pelas reais.
3. Testes de componentes no frontend: continua a não haver nenhum. O dark mode,
   os filtros e os formulários do admin estão validados por tipos, build e
   inspecção — não por cliques automatizados.
4. Paginação no shop (hoje o limite é 24 peças sem navegação entre páginas).

**Médio prazo**
5. Índice de texto completo (`pg_trgm`): a pesquisa actual usa `contains`, que
   não tolera erros de escrita — "corteis" não encontra "Corteiz".
6. Filtro de tamanhos por tipo de produto: hoje a lista mistura `S/M/L` com
   `39–45` e "Tamanho único", porque vêm todos do mesmo conjunto de variantes.
7. Guias de tamanhos por marca — o corte varia muito entre marcas, e a tabela
   actual é única para toda a loja.
8. Página de autenticidade, a explicar a verificação de originalidade. Numa
   loja multimarca em Angola é provavelmente o maior factor de confiança.

**Observação de desenho**
As fotografias de produto são disparadas sobre fundo branco, pelo que em tema
escuro formam blocos claros. É o comportamento normal em comércio electrónico
(escurecê-las falsearia a cor real do produto) e não é uma falha de contraste,
já que não há texto sobre elas. Fica registado por ser visível.

---

## 11. Como validar

```bash
cd backend && npm test && npx tsc --noEmit && npm run build
cd ../frontend && npm run lint && npx tsc --noEmit && npm run build
```

Loja em `localhost:3000`, admin em `/admin` com
`admin@chicoplug.ao` / `ChicoPlug!2026`. O alternador de tema está na navbar,
à esquerda da lupa.
