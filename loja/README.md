# CHICOPLUG — versão Python

Boutique multimarca de streetwear premium, em **HTML, CSS, JavaScript e Python**.

- **Python / Django 6** — modelos, vistas, regras de negócio
- **HTML** — templates Django renderizados no servidor
- **CSS** — Tailwind compilado para uma folha estática
- **JavaScript** — sem framework, apenas para tema, carrinho, filtros e pesquisa

## Arranque

Precisas de **Python 3.12+**, **Node** (só para compilar o CSS) e **PostgreSQL**.

```bash
cd loja
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
npm install

cp .env.example .env
createdb chicoplug_py      # ou: docker compose -f ../backend/docker-compose.yml up -d

.venv/bin/python manage.py migrate
.venv/bin/python manage.py semear     # catálogo de demonstração
npm run css                            # compila static/css/loja.css

.venv/bin/python manage.py runserver
```

Loja em http://localhost:8000 · painel em `/painel/`.

| Perfil  | Email                  | Password         |
|---------|------------------------|------------------|
| Admin   | `admin@chicoplug.ao`   | `ChicoPlug!2026` |
| Cliente | `cliente@chicoplug.ao` | `Cliente!2026`   |

Cupões: `STREET10` (10%, mínimo 80.000 Kz) e `BEMVINDO` (5.000 Kz, mínimo 30.000 Kz).

## Comandos

| Comando | O que faz |
|---|---|
| `manage.py runserver` | Servidor de desenvolvimento |
| `manage.py test` | Suite de testes (29) |
| `manage.py semear` | Recria o catálogo de demonstração |
| `manage.py migrate` | Aplica migrações |
| `npm run css` | Compila o Tailwind |
| `npm run css:watch` | Recompila ao guardar |
| `npm run build` | CSS minificado para produção |

## Estrutura

```
loja/
├── config/       definições, URLs, WSGI
├── contas/       utilizador (email como identificador), moradas, autenticação
├── catalogo/     marcas, categorias, produtos, variantes, favoritos, newsletter
├── encomendas/   carrinho, checkout, encomendas, pagamentos, cupões
├── painel/       painel de administração à medida
├── templates/    HTML (Django templates)
├── static/       CSS compilado, JavaScript, imagens, favicon
└── assets/       fonte do Tailwind
```

Ver [`RELATORIO-CONVERSAO.md`](../RELATORIO-CONVERSAO.md) para o estado detalhado.
