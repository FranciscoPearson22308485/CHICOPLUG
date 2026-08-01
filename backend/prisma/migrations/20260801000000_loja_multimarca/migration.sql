-- Reposicionamento: de marca própria para boutique multimarca.
--
-- A CHICOPLUG deixa de ter colecções próprias (Vol. 01, Night Shift) e passa a
-- vender marcas de terceiros. Esta migração é deliberadamente NÃO DESTRUTIVA:
-- os produtos existentes são preservados e atribuídos a uma marca de arquivo,
-- para que nenhuma encomenda fique órfã. O catálogo real entra pelo seed.

-- ─── Marcas ───────────────────────────────────────────────────────────────────

CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tagline" TEXT,
    "imageUrl" TEXT,
    "imagePublicId" TEXT,
    "logoUrl" TEXT,
    "logoPublicId" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");
CREATE INDEX "brands_active_position_idx" ON "brands"("active", "position");
CREATE INDEX "brands_featured_idx" ON "brands"("featured");

-- ─── Newsletter ───────────────────────────────────────────────────────────────

CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMP(3),

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");
CREATE INDEX "newsletter_subscribers_active_idx" ON "newsletter_subscribers"("active");

-- ─── Produtos: colecção → marca ───────────────────────────────────────────────

-- Adicionada como opcional para não rejeitar as linhas existentes.
ALTER TABLE "products" ADD COLUMN "brandId" TEXT;

-- Marca de arquivo para os produtos anteriores ao reposicionamento. Fica
-- inactiva: não aparece na loja, mas mantém o histórico coerente.
INSERT INTO "brands" ("id", "slug", "name", "tagline", "description", "featured", "position", "active", "createdAt", "updatedAt")
SELECT
    'brand_arquivo_chicoplug',
    'arquivo',
    'Arquivo',
    'Peças anteriores ao reposicionamento',
    'Produtos do catálogo original, mantidos para preservar o histórico de encomendas.',
    false,
    999,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "products");

UPDATE "products" SET "brandId" = 'brand_arquivo_chicoplug' WHERE "brandId" IS NULL;

-- Só agora se torna obrigatória, com todas as linhas já preenchidas.
ALTER TABLE "products" ALTER COLUMN "brandId" SET NOT NULL;

ALTER TABLE "products"
    ADD CONSTRAINT "products_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "products_brandId_idx" ON "products"("brandId");
CREATE INDEX "products_compareAt_idx" ON "products"("compareAt");

-- ─── Remoção das colecções próprias ───────────────────────────────────────────

ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_collectionId_fkey";
DROP INDEX IF EXISTS "products_collectionId_idx";
ALTER TABLE "products" DROP COLUMN IF EXISTS "collectionId";
DROP TABLE IF EXISTS "collections";
