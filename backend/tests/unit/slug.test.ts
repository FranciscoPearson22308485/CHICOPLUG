import { describe, expect, it } from "vitest";

import { buildSku, slugify, uniqueSlug } from "../../src/lib/slug.js";

describe("slugify", () => {
  it("passa nomes simples a minúsculas com hífens", () => {
    expect(slugify("Hoodie Heavyweight Noir")).toBe("hoodie-heavyweight-noir");
  });

  it("remove acentos em vez de remover as letras", () => {
    // O caso que motivou a implementação: "Calças" não pode virar "cal-as".
    expect(slugify("Calças")).toBe("calcas");
    expect(slugify("Acessórios")).toBe("acessorios");
    expect(slugify("Huíla")).toBe("huila");
    expect(slugify("Uíge")).toBe("uige");
  });

  it("colapsa pontuação e espaços em hífens únicos", () => {
    expect(slugify("Vol. 01 — Concreto")).toBe("vol-01-concreto");
    expect(slugify("T-Shirts   &   Tops")).toBe("t-shirts-tops");
  });

  it("não deixa hífens nas pontas", () => {
    expect(slugify("  --- Drop 02 ---  ")).toBe("drop-02");
  });

  it("limita o comprimento", () => {
    expect(slugify("a".repeat(300)).length).toBeLessThanOrEqual(120);
  });
});

describe("uniqueSlug", () => {
  it("devolve o slug base quando está livre", async () => {
    const result = await uniqueSlug("Hoodie Noir", () => Promise.resolve(false));
    expect(result).toBe("hoodie-noir");
  });

  it("acrescenta sufixo quando já existe", async () => {
    const taken = new Set(["hoodie-noir", "hoodie-noir-2"]);
    const result = await uniqueSlug("Hoodie Noir", (slug) => Promise.resolve(taken.has(slug)));
    expect(result).toBe("hoodie-noir-3");
  });

  it("não devolve slug vazio para entradas sem letras", async () => {
    const result = await uniqueSlug("!!!", () => Promise.resolve(false));
    expect(result).toBe("item");
  });
});

describe("buildSku", () => {
  it("produz um SKU legível", () => {
    expect(buildSku("Hoodie Heavyweight Noir", "M", "Preto")).toBe("CP-HOODIE-M-PRETO");
  });

  it("lida com acentos e nomes curtos", () => {
    expect(buildSku("Calças", "XL", "Cinzento")).toBe("CP-CALCAS-XL-CINZE");
  });
});
