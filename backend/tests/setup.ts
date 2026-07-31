/**
 * Ambiente da suite de testes.
 *
 * Definido antes de qualquer import da aplicação: `src/config/env.ts` valida o
 * ambiente no momento em que é carregado, por isso estas variáveis têm de já
 * existir. Apontamos para a base `chicoplug_test` (porta 5434, em tmpfs), que é
 * descartável — os testes apagam tabelas à vontade sem tocar em dados de
 * desenvolvimento.
 */

process.env["NODE_ENV"] = "test";
process.env["DATABASE_URL"] =
  process.env["TEST_DATABASE_URL"] ??
  "postgresql://chicoplug:chicoplug@localhost:5434/chicoplug_test?schema=public";
process.env["JWT_ACCESS_SECRET"] = "segredo-de-teste-apenas-para-a-suite-1234567890";
process.env["JWT_REFRESH_SECRET"] = "segredo-refresh-de-teste-apenas-suite-1234567890";
process.env["PAYMENTS_PROVIDER"] = "mock";
process.env["SHIPPING_FLAT_RATE"] = "3500";
process.env["FREE_SHIPPING_THRESHOLD"] = "100000";
process.env["CORS_ORIGINS"] = "http://localhost:3000";
