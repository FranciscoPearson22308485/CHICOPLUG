# CHICOPLUG — Loja Online

Boutique multimarca de streetwear premium em Luanda. Frontend TanStack Start
(originalmente gerado no Lovable) + API Express/Prisma/PostgreSQL.

Nike · Jordan · Adidas · Corteiz · Represent · Hellstar · Denim Tears ·
Essentials · Gallery Dept

```
chicoplug/
├── frontend/   TanStack Start · React 19 · Tailwind 4 (design intacto)
└── backend/    Express 4 · Prisma 6 · PostgreSQL 16 · JWT
```

## Arranque rápido

Precisas de **Node 20+** e **Docker** (para o PostgreSQL).

```bash
cd backend
cp .env.example .env
docker compose up -d          # PostgreSQL em :5433 (dev) e :5434 (testes)
npm install
npx prisma migrate deploy
npm run db:seed               # catálogo de demonstração + contas
npm run dev                   # API em http://localhost:4000
```

Noutro terminal:

```bash
cd frontend
npm install
npm run dev                   # loja em http://localhost:3000
```

O Vite encaminha `/api`, `/static` e `/sitemap.xml` para o backend, mantendo
tudo na mesma origem — é isso que faz os cookies de sessão funcionarem.

### Contas criadas pelo seed

| Perfil  | Email                  | Password        |
|---------|------------------------|-----------------|
| Admin   | `admin@chicoplug.ao`   | `ChicoPlug!2026`|
| Cliente | `cliente@chicoplug.ao` | `Cliente!2026`  |

Cupões de demonstração: `STREET10` (10%, mínimo 80.000 Kz) e `BEMVINDO`
(5.000 Kz, mínimo 30.000 Kz).

## Testes

```bash
cd backend
npx prisma migrate deploy   # uma vez, contra a base de testes
npm test                    # 121 testes
```

A base de testes (porta 5434) corre em `tmpfs` e é descartável.

```bash
DATABASE_URL="postgresql://chicoplug:chicoplug@localhost:5434/chicoplug_test?schema=public" \
  npx prisma migrate deploy
```

## Pagamentos em desenvolvimento

Sem credenciais da EMIS, o `PAYMENTS_PROVIDER=mock` corre um simulador local
completo: o checkout cria uma encomenda real com pagamento `PENDENTE` e o ecrã
mostra botões "Simular PAGO / FALHADO" (apenas fora de produção) que reproduzem
a confirmação na app do banco.

Para ligar o Multicaixa Express real, ver `RELATORIO-TECNICO.md`.

## Scripts úteis

| Comando                    | Onde       | O que faz                              |
|----------------------------|------------|----------------------------------------|
| `npm run dev`              | ambos      | Servidor de desenvolvimento            |
| `npm run build`            | ambos      | Build de produção                      |
| `npm run typecheck`        | backend    | Verificação de tipos                   |
| `npm test`                 | backend    | Suite completa                         |
| `npm run db:studio`        | backend    | Prisma Studio                          |
| `npm run db:reset`         | backend    | Recria a base e volta a semear         |

## Documentação

- [`RELATORIO-REPOSICIONAMENTO.md`](RELATORIO-REPOSICIONAMENTO.md) — a passagem
  de marca própria para boutique multimarca: alterações, ficheiros, dark mode,
  testes e o que falta configurar.
- [`RELATORIO-TECNICO.md`](RELATORIO-TECNICO.md) — estado de cada funcionalidade
  da loja, o que está validado e o que depende de configuração.
