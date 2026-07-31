/**
 * Converte texto em slug seguro para URL.
 *
 * A normalização NFD separa as letras dos acentos, e a remoção do bloco de
 * diacríticos combinantes transforma "Calças" em "calcas" em vez de perder a
 * palavra inteira — importante num catálogo em português.
 */
export function slugify(value: string): string {
  const withoutDiacritics = value
    .normalize("NFD")
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      // Bloco Unicode "Combining Diacritical Marks" (U+0300 a U+036F).
      return code < 0x0300 || code > 0x036f;
    })
    .join("");

  return withoutDiacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/**
 * Garante unicidade acrescentando um sufixo numérico. Recebe o verificador em
 * vez de consultar a base directamente, para poder ser testado sem ligação.
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || "item";
  if (!(await exists(root))) return root;

  for (let i = 2; i < 200; i += 1) {
    const candidate = `${root}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }

  return `${root}-${Date.now()}`;
}

/** SKU legível: CP-HOOD-M-PRETO. */
export function buildSku(productName: string, size: string, colorName: string): string {
  const part = (value: string, length: number) =>
    slugify(value).replace(/-/g, "").toUpperCase().slice(0, length) || "X";

  return `CP-${part(productName, 6)}-${part(size, 3)}-${part(colorName, 5)}`;
}
