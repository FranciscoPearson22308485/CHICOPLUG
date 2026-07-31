import { createFileRoute } from "@tanstack/react-router";
import { AdminButton, AdminHeading } from "@/components/site/AdminUI";
import { CATEGORIES, PRODUCTS } from "@/lib/catalog";

export const Route = createFileRoute("/admin/categorias")({
  component: AdminCategorias,
});

function AdminCategorias() {
  return (
    <div className="space-y-10">
      <AdminHeading title="Categorias" action={<AdminButton>Nova categoria</AdminButton>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CATEGORIES.map((c) => (
          <div key={c} className="border border-border bg-background p-6">
            <p className="text-sm font-semibold">{c}</p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {PRODUCTS.filter((p) => p.category === c).length} peças
            </p>
            <div className="mt-6 flex gap-5 text-[11px] font-semibold uppercase tracking-[0.16em]">
              <button className="link-underline">Editar</button>
              <button className="link-underline text-muted-foreground">Remover</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}