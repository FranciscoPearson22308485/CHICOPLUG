import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { AdminButton, AdminHeading, DataTable } from "@/components/site/AdminUI";
import { Badge, Spinner } from "@/components/site/Primitives";
import { ApiError } from "@/lib/api";
import { adminApi } from "@/lib/admin-api";
import type { Brand } from "@/lib/catalog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/marcas")({
  component: AdminMarcas,
});

type FormState = {
  name: string;
  tagline: string;
  description: string;
  imageUrl: string | null;
  imagePublicId: string | null;
  featured: boolean;
  position: number;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  tagline: "",
  description: "",
  imageUrl: null,
  imagePublicId: null,
  featured: true,
  position: 0,
  active: true,
};

function AdminMarcas() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-marcas"],
    queryFn: () => adminApi.brands(),
  });

  const brands = data?.brands ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, position: brands.length });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditing(brand);
    setForm({
      name: brand.name,
      tagline: brand.tagline,
      description: brand.description,
      imageUrl: brand.image || null,
      imagePublicId: null,
      featured: brand.featured,
      position: 0,
      active: brand.active,
    });
    setErrors({});
    setOpen(true);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const result = await adminApi.uploadImages([files[0]!], "marcas");
      const image = result.images[0];
      if (image)
        setForm((prev) => ({ ...prev, imageUrl: image.url, imagePublicId: image.publicId }));
      toast.success("Imagem optimizada");
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

    const payload = {
      name: form.name,
      tagline: form.tagline || null,
      description: form.description || null,
      imageUrl: form.imageUrl,
      imagePublicId: form.imagePublicId,
      featured: form.featured,
      position: form.position,
      active: form.active,
    };

    try {
      if (editing) {
        await adminApi.updateBrand(editing.id, payload);
        toast.success("Marca actualizada");
      } else {
        await adminApi.createBrand(payload);
        toast.success("Marca criada");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-marcas"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-taxonomy"] });
      setOpen(false);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
      } else {
        toast.error("Não foi possível guardar a marca.");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (brand: Brand) => {
    try {
      const result = await adminApi.deleteBrand(brand.id);
      await queryClient.invalidateQueries({ queryKey: ["admin-marcas"] });
      // Marcas com produtos são desactivadas, não apagadas.
      toast.success(result.archived ? (result.message ?? "Marca desactivada") : "Marca removida");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Não foi possível remover.");
    }
  };

  return (
    <div className="space-y-10">
      <AdminHeading
        title="Marcas"
        action={<AdminButton onClick={openCreate}>Nova marca</AdminButton>}
      />

      {isLoading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="size-6" />
        </div>
      ) : brands.length === 0 ? (
        <div className="border border-border bg-background px-5 py-16 text-center text-sm text-muted-foreground">
          Ainda não há marcas. Cria a primeira para começar o catálogo.
        </div>
      ) : (
        <DataTable
          columns={["Marca", "Posicionamento", "Peças", "Destaque", "Estado", ""]}
          rows={brands.map((b) => [
            <div className="flex items-center gap-4">
              {b.image ? (
                <img src={b.image} alt="" className="size-12 shrink-0 bg-surface object-cover" />
              ) : (
                <div className="size-12 shrink-0 bg-surface" />
              )}
              <span className="font-display uppercase tracking-brand">{b.name}</span>
            </div>,
            <span className="text-muted-foreground">{b.tagline || "—"}</span>,
            `${b.productCount}`,
            b.featured ? (
              <Badge tone="brand">Homepage</Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
            <Badge tone={b.active ? "dark" : "muted"}>{b.active ? "Activa" : "Inactiva"}</Badge>,
            <div className="flex gap-4 text-[11px] font-semibold uppercase tracking-[0.16em]">
              <button className="link-underline" onClick={() => openEdit(b)}>
                Editar
              </button>
              <button
                className="link-underline text-muted-foreground"
                onClick={() => void remove(b)}
              >
                Remover
              </button>
            </div>,
          ])}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {editing ? `Editar ${editing.name}` : "Nova marca"}
            </DialogTitle>
          </DialogHeader>

          <form className="mt-6 space-y-5" onSubmit={(e) => void save(e)}>
            <Field
              id="b-name"
              label="Nome"
              placeholder="Nike"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              error={errors["name"]}
            />
            <Field
              id="b-tagline"
              label="Posicionamento"
              placeholder="Sportswear icónico desde 1964"
              value={form.tagline}
              onChange={(v) => setForm({ ...form, tagline: v })}
              error={errors["tagline"]}
            />

            <div className="space-y-2">
              <Label htmlFor="b-desc" className="text-[11px] uppercase tracking-[0.16em]">
                Descrição
              </Label>
              <Textarea
                id="b-desc"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-none border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.16em]">Imagem editorial</Label>
              <div className="flex flex-wrap gap-3">
                {form.imageUrl && (
                  <div className="relative">
                    <img src={form.imageUrl} alt="" className="size-24 bg-surface object-cover" />
                    <button
                      type="button"
                      aria-label="Remover imagem"
                      onClick={() => setForm({ ...form, imageUrl: null, imagePublicId: null })}
                      className="absolute -right-2 -top-2 grid size-6 place-items-center bg-foreground text-background"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                )}
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
                    className="hidden"
                    onChange={(e) => void handleUpload(e.target.files)}
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-5">
              <div>
                <p className="text-sm font-semibold">Destacar na homepage</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Aparece em "Marcas Populares"
                </p>
              </div>
              <Switch
                checked={form.featured}
                onCheckedChange={(v) => setForm({ ...form, featured: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Marca activa</p>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-3 bg-foreground py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-60"
            >
              {saving && <Spinner className="border-background" />}
              Guardar
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  error?: string | undefined;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[11px] uppercase tracking-[0.16em]">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-12 rounded-none border-border", error && "border-destructive")}
      />
      {error && <p className="text-[11px] uppercase tracking-[0.14em] text-destructive">{error}</p>}
    </div>
  );
}
