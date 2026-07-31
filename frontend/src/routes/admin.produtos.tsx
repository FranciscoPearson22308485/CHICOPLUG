import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { AdminButton, AdminHeading, DataTable } from "@/components/site/AdminUI";
import { Badge, Spinner } from "@/components/site/Primitives";
import { formatKz, type Product } from "@/lib/catalog";
import { ApiError } from "@/lib/api";
import { adminApi, type ProductInput, type VariantInput } from "@/lib/admin-api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/produtos")({
  component: AdminProdutos,
});

const BADGES = [
  { value: "none", label: "Sem distintivo" },
  { value: "NOVO", label: "Novo" },
  { value: "DROP", label: "Drop" },
  { value: "ULTIMAS_UNIDADES", label: "Últimas unidades" },
] as const;

const EMPTY_VARIANT: VariantInput = {
  size: "M",
  colorName: "Preto",
  colorHex: "#111111",
  stock: 0,
  lowStockThreshold: 6,
  active: true,
};

type FormState = ProductInput & { detailsText: string };

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  details: [],
  detailsText: "",
  price: 0,
  compareAt: null,
  categoryId: "",
  collectionId: null,
  badge: null,
  isNew: false,
  isDrop: false,
  bestSeller: false,
  active: true,
  metaTitle: null,
  metaDescription: null,
  images: [],
  variants: [{ ...EMPTY_VARIANT }],
};

function AdminProdutos() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-produtos", search],
    queryFn: () => adminApi.products({ search: search || undefined, pageSize: 50 }),
  });

  const { data: taxonomy } = useQuery({
    queryKey: ["admin-taxonomy"],
    queryFn: async () => {
      const [cats, cols] = await Promise.all([adminApi.categories(), adminApi.collections()]);
      return { categories: cats.categories, collections: cols.collections };
    },
  });

  const products = data?.products ?? [];
  const categories = taxonomy?.categories ?? [];
  const collections = taxonomy?.collections ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? "" });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description,
      details: product.details,
      detailsText: product.details.join("\n"),
      price: product.price,
      compareAt: product.compareAt ?? null,
      categoryId: categories.find((c) => c.name === product.category)?.id ?? "",
      collectionId: collections.find((c) => c.slug === product.collectionSlug)?.id ?? null,
      // `badgeKey` é a chave do enum; `badge` é só o rótulo apresentado.
      badge: (product.badgeKey as ProductInput["badge"]) ?? null,
      isNew: Boolean(product.isNew),
      isDrop: Boolean(product.isDrop),
      bestSeller: Boolean(product.bestSeller),
      active: product.active,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      images: product.images.map((url) => ({ url })),
      variants: product.variants.map((v) => ({
        id: v.id,
        size: v.size,
        colorName: v.colorName,
        colorHex: v.colorHex,
        stock: v.stock,
        lowStockThreshold: v.lowStockThreshold ?? 6,
        active: v.active,
      })),
    });
    setErrors({});
    setOpen(true);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const result = await adminApi.uploadImages(Array.from(files), "produtos");
      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...result.images.map((i) => ({ url: i.url, publicId: i.publicId }))],
      }));
      toast.success(`${result.images.length} imagem(ns) optimizada(s)`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Falha no upload.");
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    const payload: ProductInput = {
      ...form,
      // Uma linha por bullet do acordeão "Detalhes".
      details: form.detailsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      price: Number(form.price),
      compareAt: form.compareAt ? Number(form.compareAt) : null,
      collectionId: form.collectionId || null,
    };

    try {
      if (editing) {
        await adminApi.updateProduct(editing.id, payload);
        toast.success("Produto actualizado");
      } else {
        await adminApi.createProduct(payload);
        toast.success("Produto criado");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-produtos"] });
      setOpen(false);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
      } else {
        toast.error("Não foi possível guardar o produto.");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (product: Product) => {
    try {
      const result = await adminApi.deleteProduct(product.id);
      await queryClient.invalidateQueries({ queryKey: ["admin-produtos"] });
      // Produtos com vendas são arquivados, não apagados — dizemos qual foi.
      toast.success(result.archived ? (result.message ?? "Produto arquivado") : "Produto removido");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Não foi possível remover.");
    }
  };

  const setVariant = (index: number, patch: Partial<VariantInput>) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));
  };

  return (
    <div className="space-y-10">
      <AdminHeading
        title="Produtos"
        action={<AdminButton onClick={openCreate}>Novo produto</AdminButton>}
      />

      <div className="flex items-center gap-3 border border-border bg-background px-5 py-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Procurar por nome ou slug…"
          aria-label="Procurar produtos"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {isLoading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="size-6" />
        </div>
      ) : (
        <DataTable
          columns={["Peça", "Categoria", "Preço", "Stock", "Estado", "Acções"]}
          rows={products.map((p) => [
            <div className="flex items-center gap-4">
              {p.images[0] ? (
                <img src={p.images[0]} alt="" className="size-12 shrink-0 bg-surface object-cover" />
              ) : (
                <div className="size-12 shrink-0 bg-surface" />
              )}
              <span className="truncate">{p.name}</span>
            </div>,
            p.category,
            formatKz(p.price),
            `${p.stock}`,
            <Badge tone={!p.active ? "muted" : p.stock === 0 ? "muted" : "dark"}>
              {!p.active ? "Inactivo" : p.stock === 0 ? "Esgotado" : "Activo"}
            </Badge>,
            <div className="flex gap-4 text-[11px] font-semibold uppercase tracking-[0.16em]">
              <button className="link-underline" onClick={() => openEdit(p)}>
                Editar
              </button>
              <button
                className="link-underline text-muted-foreground"
                onClick={() => void remove(p)}
              >
                Remover
              </button>
            </div>,
          ])}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-none">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {editing ? `Editar ${editing.name}` : "Novo produto"}
            </DialogTitle>
          </DialogHeader>

          <form className="mt-6 space-y-8" onSubmit={(e) => void save(e)}>
            <section className="space-y-5">
              <p className="eyebrow">Identidade</p>
              <FormField
                id="p-name"
                label="Nome"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                error={errors["name"]}
              />
              <div className="space-y-2">
                <Label htmlFor="p-desc" className="text-[11px] uppercase tracking-[0.16em]">
                  Descrição
                </Label>
                <Textarea
                  id="p-desc"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="rounded-none border-border"
                />
                {errors["description"] && <ErrorText>{errors["description"]}</ErrorText>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-details" className="text-[11px] uppercase tracking-[0.16em]">
                  Detalhes (um por linha)
                </Label>
                <Textarea
                  id="p-details"
                  rows={4}
                  value={form.detailsText}
                  placeholder={"100% algodão 480gsm\nCorte oversized"}
                  onChange={(e) => setForm({ ...form, detailsText: e.target.value })}
                  className="rounded-none border-border"
                />
              </div>
            </section>

            <section className="space-y-5">
              <p className="eyebrow">Preço e classificação</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  id="p-price"
                  label="Preço (Kz)"
                  type="number"
                  value={String(form.price)}
                  onChange={(v) => setForm({ ...form, price: Number(v) })}
                  error={errors["price"]}
                />
                <FormField
                  id="p-compare"
                  label="Preço anterior (opcional)"
                  type="number"
                  value={form.compareAt ? String(form.compareAt) : ""}
                  onChange={(v) => setForm({ ...form, compareAt: v ? Number(v) : null })}
                  error={errors["compareAt"]}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-[0.16em]">Categoria</Label>
                  <Select
                    value={form.categoryId}
                    onValueChange={(v) => setForm({ ...form, categoryId: v })}
                  >
                    <SelectTrigger className="h-12 rounded-none border-border">
                      <SelectValue placeholder="Seleciona" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors["categoryId"] && <ErrorText>{errors["categoryId"]}</ErrorText>}
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-[0.16em]">Colecção</Label>
                  <Select
                    value={form.collectionId ?? "none"}
                    onValueChange={(v) =>
                      setForm({ ...form, collectionId: v === "none" ? null : v })
                    }
                  >
                    <SelectTrigger className="h-12 rounded-none border-border">
                      <SelectValue placeholder="Sem colecção" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="none">Sem colecção</SelectItem>
                      {collections.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.16em]">Distintivo</Label>
                <Select
                  value={form.badge ?? "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, badge: v === "none" ? null : (v as ProductInput["badge"]) })
                  }
                >
                  <SelectTrigger className="h-12 rounded-none border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {BADGES.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* "Esgotado" não é escolha do admin: deriva do stock real. */}
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  O distintivo "Esgotado" é aplicado automaticamente quando o stock chega a zero.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Toggle
                  label="Novidade"
                  checked={form.isNew}
                  onChange={(v) => setForm({ ...form, isNew: v })}
                />
                <Toggle
                  label="Drop"
                  checked={form.isDrop}
                  onChange={(v) => setForm({ ...form, isDrop: v })}
                />
                <Toggle
                  label="Best seller"
                  checked={form.bestSeller}
                  onChange={(v) => setForm({ ...form, bestSeller: v })}
                />
                <Toggle
                  label="Visível na loja"
                  checked={form.active}
                  onChange={(v) => setForm({ ...form, active: v })}
                />
              </div>
            </section>

            <section className="space-y-5">
              <p className="eyebrow">Imagens</p>
              <div className="flex flex-wrap gap-3">
                {form.images.map((image, index) => (
                  <div key={image.url} className="relative">
                    <img src={image.url} alt="" className="size-24 bg-surface object-cover" />
                    <button
                      type="button"
                      aria-label="Remover imagem"
                      onClick={() =>
                        setForm({ ...form, images: form.images.filter((_, i) => i !== index) })
                      }
                      className="absolute -right-2 -top-2 grid size-6 place-items-center bg-foreground text-background"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                <label
                  className={cn(
                    "grid size-24 cursor-pointer place-items-center border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground",
                    uploading && "pointer-events-none opacity-60",
                  )}
                >
                  {uploading ? <Spinner /> : <Upload className="size-5" />}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleUpload(e.target.files)}
                  />
                </label>
              </div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                As imagens são convertidas para WebP e redimensionadas automaticamente.
              </p>
            </section>

            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Variantes (tamanho × cor)</p>
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, variants: [...form.variants, { ...EMPTY_VARIANT }] })
                  }
                  className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] hover:text-brand"
                >
                  <Plus className="size-3.5" /> Adicionar
                </button>
              </div>

              {errors["variants"] && <ErrorText>{errors["variants"]}</ErrorText>}

              <div className="space-y-3">
                {form.variants.map((variant, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_1fr_auto_1fr_auto] items-end gap-3 border border-border p-4"
                  >
                    <MiniField
                      label="Tamanho"
                      value={variant.size}
                      onChange={(v) => setVariant(index, { size: v })}
                    />
                    <MiniField
                      label="Cor"
                      value={variant.colorName}
                      onChange={(v) => setVariant(index, { colorName: v })}
                    />
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-[0.14em]">Hex</Label>
                      <input
                        type="color"
                        value={variant.colorHex}
                        onChange={(e) => setVariant(index, { colorHex: e.target.value })}
                        className="h-10 w-12 cursor-pointer border border-border bg-transparent"
                      />
                    </div>
                    <MiniField
                      label="Stock"
                      type="number"
                      value={String(variant.stock)}
                      onChange={(v) => setVariant(index, { stock: Number(v) })}
                    />
                    <button
                      type="button"
                      aria-label="Remover variante"
                      disabled={form.variants.length === 1}
                      onClick={() =>
                        setForm({
                          ...form,
                          variants: form.variants.filter((_, i) => i !== index),
                        })
                      }
                      className="grid size-10 place-items-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-3 bg-foreground py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-60"
            >
              {saving && <Spinner className="border-background" />}
              {editing ? "Guardar alterações" : "Criar produto"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-[0.14em] text-destructive">{children}</p>;
}

function FormField({
  id,
  label,
  value,
  onChange,
  type = "text",
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string | undefined;
  error?: string | undefined;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[11px] uppercase tracking-[0.16em]">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-12 rounded-none border-border", error && "border-destructive")}
      />
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function MiniField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string | undefined;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-[0.14em]">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-none border-border"
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border border-border px-4 py-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
