import { Router } from "express";

import { env } from "../../config/env.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { prisma } from "../../lib/prisma.js";

export const seoRouter = Router();

/** Escapa os cinco caracteres que quebrariam o XML. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type Entry = { loc: string; lastmod?: string; changefreq: string; priority: string };

function renderSitemap(entries: Entry[]): string {
  const urls = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : "";
      return `  <url>
    <loc>${xmlEscape(entry.loc)}</loc>${lastmod}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

/**
 * Sitemap gerado a partir da base de dados: cada produto e colecção publicados
 * entram automaticamente. Um sitemap escrito à mão fica desactualizado no
 * primeiro drop.
 */
seoRouter.get(
  "/sitemap.xml",
  asyncHandler(async (_req, res) => {
    const base = env.PUBLIC_SITE_URL.replace(/\/$/, "");

    const [products, collections] = await Promise.all([
      prisma.product.findMany({
        where: { active: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.collection.findMany({
        where: { active: true },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    const staticPages: Entry[] = [
      { loc: `${base}/`, changefreq: "daily", priority: "1.0" },
      { loc: `${base}/shop`, changefreq: "daily", priority: "0.9" },
      { loc: `${base}/colecoes`, changefreq: "weekly", priority: "0.8" },
      { loc: `${base}/sobre`, changefreq: "monthly", priority: "0.5" },
      { loc: `${base}/contacto`, changefreq: "monthly", priority: "0.5" },
      { loc: `${base}/faq`, changefreq: "monthly", priority: "0.4" },
      { loc: `${base}/termos`, changefreq: "yearly", priority: "0.3" },
      { loc: `${base}/politica-de-privacidade`, changefreq: "yearly", priority: "0.3" },
      { loc: `${base}/politica-de-trocas`, changefreq: "yearly", priority: "0.3" },
    ];

    const entries: Entry[] = [
      ...staticPages,
      ...collections.map((c) => ({
        loc: `${base}/colecoes/${c.slug}`,
        lastmod: c.updatedAt.toISOString(),
        changefreq: "weekly",
        priority: "0.7",
      })),
      ...products.map((p) => ({
        loc: `${base}/produto/${p.slug}`,
        lastmod: p.updatedAt.toISOString(),
        changefreq: "weekly",
        priority: "0.8",
      })),
    ];

    res.type("application/xml");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(renderSitemap(entries));
  }),
);

seoRouter.get("/robots.txt", (_req, res) => {
  const base = env.PUBLIC_SITE_URL.replace(/\/$/, "");

  res.type("text/plain");
  res.set("Cache-Control", "public, max-age=86400");
  res.send(
    [
      "User-agent: *",
      "Allow: /",
      "",
      "# Áreas privadas e de transacção — sem valor para indexação.",
      "Disallow: /admin",
      "Disallow: /conta",
      "Disallow: /carrinho",
      "Disallow: /checkout",
      "Disallow: /entrar",
      "Disallow: /registo",
      "Disallow: /recuperar-password",
      "Disallow: /repor-password",
      "Disallow: /api/",
      "",
      `Sitemap: ${base}/sitemap.xml`,
      "",
    ].join("\n"),
  );
});
