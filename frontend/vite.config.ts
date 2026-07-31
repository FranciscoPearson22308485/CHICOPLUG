// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const API_TARGET = process.env["VITE_API_INTERNAL_URL"] ?? "http://localhost:4000";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      // Encaminha a API para o Express mantendo tudo na mesma origem.
      //
      // É isto que faz os cookies de sessão funcionarem: com o frontend em
      // :3000 e a API em :4000, o browser trataria os pedidos como cross-site e
      // recusaria enviar cookies `SameSite=Lax` — o login parecia resultar mas
      // nenhuma página autenticada carregava. Em produção o mesmo papel cabe ao
      // reverse proxy (nginx/Caddy) ou a servir a API em /api do mesmo domínio.
      proxy: {
        "/api": { target: API_TARGET, changeOrigin: true },
        "/static": { target: API_TARGET, changeOrigin: true },
        "/sitemap.xml": { target: API_TARGET, changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Separa as bibliotecas do nosso código: mudam raramente e ficam em
          // cache do browser entre deploys, em vez de serem rebuscadas sempre.
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("react-dom") || id.includes("/react/")) return "react";
            if (id.includes("@tanstack")) return "tanstack";
            if (id.includes("@radix-ui")) return "radix";
            if (id.includes("recharts") || id.includes("d3-")) return "charts";
            if (id.includes("lucide-react")) return "icons";
            return "vendor";
          },
        },
      },
      chunkSizeWarningLimit: 400,
    },
  },
});
