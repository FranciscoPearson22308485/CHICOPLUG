import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Toaster } from "@/components/ui/sonner";
import { useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/context/auth";
import { CartProvider } from "@/context/cart";
import { WishlistProvider } from "@/context/wishlist";
import { JsonLd, organizationSchema, websiteSchema } from "@/lib/seo";
import { ThemeProvider, themeInitScript } from "@/context/theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CHICOPLUG — Streetwear Premium | Nike, Jordan, Corteiz e mais" },
      {
        name: "description",
        content:
          "As melhores marcas de streetwear num só lugar. Nike, Jordan, Adidas, Corteiz, Represent, Essentials e Denim Tears, com entrega em todo o Angola.",
      },
      { name: "author", content: "CHICOPLUG" },
      { name: "theme-color", content: "#111111" },
      { name: "apple-mobile-web-app-title", content: "CHICOPLUG" },
      { name: "apple-mobile-web-app-capable", content: "yes" },

      { property: "og:site_name", content: "CHICOPLUG" },
      { property: "og:title", content: "CHICOPLUG — Streetwear Premium" },
      {
        property: "og:description",
        content: "As melhores marcas de streetwear num só lugar. Entrega em todo o Angola.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_AO" },
      { property: "og:image", content: "/icon-512.png" },

      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@chicoplug" },
      { name: "twitter:title", content: "CHICOPLUG — Streetwear Premium" },
      {
        name: "twitter:description",
        content: "As melhores marcas de streetwear num só lugar.",
      },
      { name: "twitter:image", content: "/icon-512.png" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Manrope:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },

      // O SVG é preferido pelos browsers modernos e escala sem perder nitidez;
      // o .ico serve os que ainda não o suportam.
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Corre antes da primeira pintura: aplica o tema guardado (ou o do
            sistema) para que ninguém veja um clarão branco ao entrar. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/admin");

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              {/* Dados estruturados da marca — aplicam-se a todas as páginas. */}
              <JsonLd schema={organizationSchema()} />
              <JsonLd schema={websiteSchema()} />
              {!isAdmin && <Navbar />}
              <main className="min-h-screen">
                {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
                <Outlet />
              </main>
              {!isAdmin && <Footer />}
              <Toaster />
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
