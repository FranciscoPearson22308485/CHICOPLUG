import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "cp-theme";

type ThemeContextValue = {
  /** Preferência escolhida — pode ser "system". */
  theme: Theme;
  /** Tema realmente aplicado, já resolvido. */
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Script que corre antes da primeira pintura.
 *
 * Sem isto, o servidor renderiza sempre em tema claro e um visitante com
 * preferência escura veria um clarão branco antes de o React hidratar. O script
 * lê a preferência guardada — ou a do sistema operativo na primeira visita — e
 * aplica a classe imediatamente.
 *
 * Vai para o `<head>` como texto: tem de ser síncrono e anterior ao React.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || ((stored === 'system' || !stored) && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
  document.documentElement.setAttribute('data-theme-ready', '');
})();
`.trim();

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(resolved: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  // Faz os controlos nativos (scrollbars, campos) acompanharem o tema.
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Arranca em "system": é a preferência menos presunçosa para a primeira
  // visita, e o script inline já pintou o ecrã de acordo com ela.
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemDark, setSystemDark] = useState(false);

  // Lê a preferência guardada só depois de montar: em SSR não há localStorage,
  // e ler durante o render provocaria divergência entre servidor e cliente.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
    }
    setSystemDark(systemPrefersDark());
  }, []);

  // Acompanha mudanças do sistema em tempo real (ex.: agendamento noturno do
  // macOS) enquanto a preferência for "system".
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Modo privado com armazenamento bloqueado: o tema funciona na sessão.
    }
  }, []);

  /** Alterna entre claro e escuro, fixando a escolha explícita do utilizador. */
  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme tem de ser usado dentro de <ThemeProvider>.");
  return context;
}
