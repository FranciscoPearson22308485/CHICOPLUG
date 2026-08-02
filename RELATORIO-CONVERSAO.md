# CHICOPLUG — Conversão para HTML, CSS, JavaScript e Python

**Data:** 2 de Agosto de 2026
**Âmbito:** reescrever a loja em Django + templates HTML + Tailwind + JavaScript
sem framework, substituindo o TanStack Start (React/TS) e o Express/Prisma (TS).

---

## 1. O que foi feito

Não foi uma conversão — foi uma **reescrita**. Nenhuma linha de TypeScript se
aproveita: componentes React tornam-se templates Django, o Prisma dá lugar ao
ORM do Django, o JWT dá lugar às sessões, e os contextos React dão lugar a
JavaScript sem framework.

| | TypeScript (antes) | Python (agora) |
|---|---|---|
| Servidor | Express 4 + TanStack Start | **Django 6** |
| ORM | Prisma | **Django ORM** |
| Páginas | React 19 (SSR) | **Templates Django** |
| Estilo | Tailwind 4 | **Tailwind 4** (igual) |
| Interacção | React + contextos | **JavaScript sem framework** |
| Autenticação | JWT + refresh rotativo | **Sessões do Django** |
| Testes | 139 (Vitest) | **29 (Django)** |

**Escolhas que fizeste:** Django, templates no servidor, manter o Tailwind. Uma
consequência que assumi por ti: como já tens um painel desenhado à medida,
deixei o **`django.contrib.admin` fora das aplicações instaladas**. Ter duas
portas para o mesmo sítio — uma bonita e outra genérica — só criava confusão e
superfície de ataque.

### Porque o Tailwind ficou

O Tailwind compila para CSS puro. As classes passaram do JSX para os templates
sem alteração, por isso o desenho é **o mesmo**, incluindo o dark mode
monocromático e os tokens da marca. Reescrever ~2.000 utilitários à mão era o
caminho mais rápido para perder a identidade visual.

---

## 2. Estrutura

```
loja/
├── config/       definições, URLs, WSGI
├── contas/       Utilizador (email como identificador), Morada, autenticação
├── catalogo/     Marca, Categoria, Produto, Variante, Favorito, Subscritor
├── encomendas/   Carrinho, Encomenda, Pagamento, Cupão + regras de negócio
├── painel/       painel de administração à medida
├── templates/    36 templates HTML
├── static/       CSS compilado, JavaScript, imagens, favicon
└── assets/       fonte do Tailwind
```

### Decisões de modelação preservadas

**O stock vive na variante.** `Variante` é a combinação tamanho × cor, com o seu
próprio stock e SKU. O número que a interface mostra é a soma — guardar um stock
único por produto tornaria impossível saber que há L em preto mas não em
cinzento.

**As linhas de encomenda são desnormalizadas.** `ItemEncomenda` copia marca,
nome, preço e imagem no momento da compra. Há um teste que muda o preço do
produto depois da venda e prova que o histórico não se reescreve.

**A prevenção de venda a descoberto sobreviveu à mudança de ORM.** O que em
Prisma era `updateMany({ where: { stock: { gte: n } } })` é agora
`Variante.objects.filter(pk=..., stock__gte=n).update(stock=F("stock") - n)` —
concorrência optimista numa só instrução SQL. Ler o stock e depois escrevê-lo
teria uma janela de corrida que vende a mesma peça duas vezes.

---

## 3. Funcionalidades

**Loja** — homepage com as 8 secções na ordem pedida, shop com os 6 filtros
(marca, categoria, preço, tamanho, cor, disponibilidade) guardados no URL,
pesquisa por marca/produto/categoria com sugestões, páginas de marca, ficha de
produto com selector de variantes, carrinho com e sem conta, checkout com
cupões, pagamentos com máquina de estados.

**Contas** — registo, login por email, recuperação de password (vistas do
Django, que já tratam de tokens assinados), perfil, favoritos, moradas com
morada principal exclusiva, histórico de encomendas.

**Painel** — dashboard com métricas reais, produtos, marcas, categorias,
encomendas com filtro por estado, alertas de stock, estado das integrações.

**Segurança** — CSRF do Django em todos os formulários, sessões `HttpOnly`,
`SECURE_HSTS` e cookies seguros fora de DEBUG, validadores de password,
`X-Frame-Options: DENY`, e o ORM a parametrizar todas as consultas.

---

## 4. Testes

**29 testes, todos a passar** (`manage.py test`):

| Grupo | Cobre |
|---|---|
| Máquina de estados (6) | Percurso feliz, saltos, retrocessos, estados finais, reposição de stock |
| Envio (3) | Carrinho vazio, abaixo e no limiar |
| Cupões (5) | Percentagem, arredondamento, tecto no subtotal, expiração, mínimo |
| Carrinho (4) | Sem conta, soma de quantidades, limites de stock |
| Checkout (4) | Criação, decremento, instantâneo do produto, venda a descoberto |
| Ciclo de vida (4) | Reposição de stock, não repor a dobrar, transições inválidas, histórico |
| Acesso (3) | Painel exige admin, isolamento de carrinhos entre sessões |

**Verificação manual:** as 14 rotas principais respondem (o painel dá 302 sem
sessão de administrador, como deve), e a homepage, o shop filtrado e a ficha de
produto renderizam com marca, preço, desconto, Schema.org e selector de
variantes.

### O que não foi testado

- **Não há testes de JavaScript.** O tema, os filtros, o selector de variantes e
  as sugestões de pesquisa foram verificados por inspecção do HTML gerado, não
  por execução no browser.
- **O painel não foi percorrido a clicar.** As vistas respondem e os testes
  cobrem o controlo de acesso; os ecrãs em si, não.
- **O adaptador Multicaixa nunca contactou a EMIS.**
- **O dark mode nesta versão não foi verificado visualmente.** O CSS e o script
  anti-flash são os mesmos da versão TypeScript, onde foram validados, mas não
  repeti a inspecção aqui.

---

## 5. Erros encontrados e corrigidos

1. **XSS nas sugestões de pesquisa.** A primeira versão construía os resultados
   com `innerHTML`; um produto chamado `<img onerror=…>` seria executado.
   Reescrito com `createElement` e `textContent`.
2. **Colisão de SKU no seed.** Duas peças da mesma marca geravam o mesmo SKU no
   mesmo tamanho e cor. Resolvido com contador global.
3. **Testes a falhar por `ManifestStaticFilesStorage`.** Sem `collectstatic`, o
   `{% static %}` rebentava. As definições passam a usar armazenamento simples
   durante os testes.

---

## 6. O que ficou por converter

Sê consciente destas lacunas — a versão TypeScript tinha-as e esta ainda não:

1. **CRUD de escrita no painel.** O painel Django **lê** tudo (produtos, marcas,
   categorias, encomendas, stock, definições) mas ainda não tem os formulários
   de criar/editar/remover, nem o ajuste de stock em lote, nem a exportação CSV.
   É o maior bloco em falta.
2. **Cupões e relatórios no painel.** Os modelos existem e funcionam no
   checkout; faltam os ecrãs de gestão.
3. **Upload de imagens.** Os modelos usam `ImageField` e o seed preenche-os,
   mas não há ecrã de upload nem integração Cloudinary — só disco local.
4. **Sitemap e robots.txt.** O `django.contrib.sitemaps` está instalado mas as
   classes não foram escritas.
5. **Mudança de estado de encomendas pelo administrador.** A função existe e
   está testada (`mudar_estado`); falta o botão no painel.

---

## 7. Depende de configuração

1. **Envio de emails** — sem `EMAIL_HOST`, tudo vai para a consola. Afecta a
   recuperação de password e as confirmações.
2. **Multicaixa Express** — credenciais EMIS **e** confirmação dos nomes de
   campos e do esquema de assinatura contra a documentação oficial. Os pontos a
   rever estão marcados no código com `CONFIRMAR CONTRA A DOCUMENTAÇÃO OFICIAL`.
3. **Cloudinary** — variáveis definidas nas settings, integração por escrever.
4. **`SECRET_KEY` e domínio** — o Django recusa arrancar com `DEBUG=False` e a
   chave de desenvolvimento.

---

## 8. As duas versões coexistem

A versão TypeScript continua em `frontend/` e `backend/`, intacta e funcional.
Não a apaguei: essa decisão é tua, e enquanto o painel Python não tiver o CRUD
completo, a versão antiga ainda faz coisas que a nova não faz.

```bash
# Python (nova)
cd loja && .venv/bin/python manage.py runserver      # :8000

# TypeScript (anterior)
cd backend && npm run dev                             # :4000
cd frontend && npm run dev                            # :3000
```

---

## 9. Melhorias recomendadas

1. Completar o CRUD do painel — é o que separa esta versão de substituir a
   anterior por inteiro.
2. Ligar o envio de emails.
3. Escrever as classes de sitemap.
4. Testes de JavaScript e uma passagem visual pelo dark mode nesta versão.
5. Índice de texto completo (`pg_trgm`): a pesquisa usa `icontains`, que não
   tolera erros de escrita.
6. Cache de fragmentos nos cards de produto — a homepage faz cinco consultas
   com `prefetch_related`, o que já é razoável, mas escala melhor com cache.
