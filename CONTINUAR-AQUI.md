# Prompt para continuar noutra conversa

Copia tudo o que está abaixo da linha para a nova conversa.

---

Estou a trabalhar no projeto **CHICOPLUG** em `~/Documents/GitHub/chicoplug`
(repositório: https://github.com/FranciscoPearson22308485/CHICOPLUG, branch `main`).

É uma **boutique multimarca de streetwear premium** em Angola — a loja NÃO
fabrica roupa, revende Nike, Jordan, Adidas, Corteiz, Represent, Hellstar,
Denim Tears, Essentials e Gallery Dept.

## Estado actual

O repositório tem **duas implementações completas** que coexistem:

```
chicoplug/
├── frontend/   TanStack Start (React 19 + TS) — versão anterior, funcional
├── backend/    Express + Prisma + PostgreSQL (TS) — versão anterior, funcional
└── loja/       Django 6 + templates HTML + Tailwind + JS — versão NOVA
```

A versão TypeScript está completa e com 139 testes a passar. A versão Python
(`loja/`) foi a conversão pedida e está funcional mas **incompleta** — é aí que
quero continuar.

### Regras que se mantêm desde o início

- **NÃO alterar o design.** As classes Tailwind são as mesmas nas duas versões.
- **NÃO reconstruir** o que já funciona.
- Tudo em **português de Portugal** (código, comentários, interface).
- Valores monetários em **Kwanzas inteiros** (sem cêntimos).

## Arranque da versão Python

```bash
cd ~/Documents/GitHub/chicoplug/loja
# O Postgres corre em Docker na porta 5433 (container chicoplug-postgres).
# Se estiver parado: open -a Docker && docker start chicoplug-postgres
.venv/bin/python manage.py runserver     # :8000
npm run css:watch                         # noutro terminal, recompila o Tailwind
```

Contas: `admin@chicoplug.ao` / `ChicoPlug!2026` · `cliente@chicoplug.ao` / `Cliente!2026`
Testes: `.venv/bin/python manage.py test` → 29 a passar.

## Arquitectura da versão Python

```
loja/
├── config/       settings, urls, wsgi
├── contas/       Utilizador (email como identificador), Morada, EmailBackend
├── catalogo/     Marca, Categoria, Produto, Variante, Favorito, Subscritor, Definicao
├── encomendas/   Carrinho, Encomenda, Pagamento, Cupao + services.py (regras) + pagamentos.py
├── painel/       painel de administração à medida
├── templates/    36 templates
├── static/       css/loja.css (compilado), js/loja.js, img/, favicon
└── assets/css/entrada.css   ← fonte do Tailwind
```

Decisões importantes já tomadas (não desfazer):
- `django.contrib.admin` está **fora** do `INSTALLED_APPS` — o painel é à medida.
- O stock vive na **Variante** (tamanho × cor), não no Produto.
- `ItemEncomenda` é **desnormalizado** — copia marca/nome/preço/imagem na compra.
- Decremento de stock com `filter(stock__gte=n).update(stock=F("stock") - n)`
  (concorrência optimista; impede vender a mesma peça duas vezes).
- Máquina de estados das encomendas em `encomendas/models.py` (`TRANSICOES`).
- Pagamentos com porta/adaptador em `encomendas/pagamentos.py`: `Simulador`
  (funcional) e `MulticaixaExpress` (inerte sem credenciais).

## O que quero que faças a seguir

Por ordem de prioridade — está tudo detalhado em `RELATORIO-CONVERSAO.md` §6:

1. **CRUD de escrita no painel** (o maior bloco em falta). Hoje o painel só lê.
   Falta criar/editar/remover para produtos, marcas, categorias e cupões;
   ajuste de stock em lote; mudança de estado das encomendas (a função
   `mudar_estado` já existe e está testada — falta o botão); exportação CSV.
2. **Upload de imagens** no painel (os modelos já têm `ImageField`).
3. **Sitemap e robots.txt** — o `django.contrib.sitemaps` está instalado mas as
   classes não foram escritas.
4. **Ecrãs de cupões e relatórios** no painel.
5. **Testes de JavaScript** e uma passagem visual pelo dark mode nesta versão
   (o CSS é o mesmo já validado na versão TS, mas não repeti a inspecção).

Segue os padrões que já lá estão: `services.py` para regras de negócio, views
finas, templates a estender `painel/base.html`, e testes em `encomendas/tests.py`.

## Pendente de configuração (não é bug)

- **Envio de emails** — sem `EMAIL_HOST`, tudo vai para a consola. Afecta a
  recuperação de password.
- **Multicaixa Express** — faltam credenciais EMIS **e** confirmar os nomes dos
  campos e o esquema de assinatura contra a documentação oficial. Os pontos a
  rever estão marcados no código com `CONFIRMAR CONTRA A DOCUMENTAÇÃO OFICIAL`.
- **Cloudinary** — variáveis nas settings, integração por escrever.

## Documentação no repositório

- `RELATORIO-CONVERSAO.md` — a conversão para Python: o que foi feito, testado,
  e o que ficou por converter.
- `RELATORIO-REPOSICIONAMENTO.md` — a passagem de marca própria a multimarca.
- `RELATORIO-TECNICO.md` — estado da versão TypeScript.
- `loja/README.md` — arranque da versão Python.

Faz sempre commit e push depois de cada bloco de trabalho concluído.
