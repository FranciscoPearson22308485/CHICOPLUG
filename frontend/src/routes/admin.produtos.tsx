import { createFileRoute } from "@tanstack/react-router";
import { AdminButton, AdminHeading, DataTable } from "@/components/site/AdminUI";
import { Badge } from "@/components/site/Primitives";
import { PRODUCTS, formatKz } from "@/lib/catalog";

export const Route = createFileRoute("/admin/produtos")({
  component: AdminProdutos,
});

function AdminProdutos() {
  return (
    <div className="space-y-10">
      <AdminHeading title="Produtos" action={<AdminButton>Novo produto</AdminButton>} />
      <DataTable
        columns={["Peça", "Categoria", "Preço", "Stock", "Estado"]}
        rows={PRODUCTS.map((p) => [
          <div className="flex items-center gap-4">
            <img src={p.images[0]} alt="" className="size-12 shrink-0 bg-surface object-cover" />
            <span className="truncate">{p.name}</span>
          </div>,
          p.category,
          formatKz(p.price),
          `${p.stock}`,
          <Badge tone={p.stock === 0 ? "muted" : "dark"}>{p.stock === 0 ? "Esgotado" : "Ativo"}</Badge>,
        ])}
      />
    </div>
  );
}