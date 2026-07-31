import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminButton, AdminHeading } from "@/components/site/AdminUI";
import { Spinner } from "@/components/site/Primitives";
import { ApiError } from "@/lib/api";
import { adminApi } from "@/lib/admin-api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/categorias")({
  component: AdminCategorias,
});

type Editing = { id: string; name: string; description: string; position: number } | null;

function AdminCategorias() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-categorias"],
    queryFn: () => adminApi.categories(),
  });

  const categories = data?.categories ?? [];

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setOpen(true);
  };

  const openEdit = (category: (typeof categories)[number]) => {
    setEditing({
      id: category.id,
      name: category.name,
      description: category.description ?? "",
      position: category.position,
    });
    setName(category.name);
    setDescription(category.description ?? "");
    setOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await adminApi.updateCategory(editing.id, { name, description: description || null });
        toast.success("Categoria actualizada");
      } else {
        await adminApi.createCategory({ name, description: description || null });
        toast.success("Categoria criada");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-categorias"] });
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await adminApi.deleteCategory(id);
      await queryClient.invalidateQueries({ queryKey: ["admin-categorias"] });
      toast.success("Categoria removida");
    } catch (error) {
      // O backend recusa apagar categorias com produtos e explica porquê.
      toast.error(error instanceof ApiError ? error.message : "Não foi possível remover.");
    }
  };

  return (
    <div className="space-y-10">
      <AdminHeading
        title="Categorias"
        action={<AdminButton onClick={openCreate}>Nova categoria</AdminButton>}
      />

      {isLoading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="size-6" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((c) => (
            <div key={c.id} className="border border-border bg-background p-6">
              <p className="text-sm font-semibold">{c.name}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {c.productCount} {c.productCount === 1 ? "peça" : "peças"}
              </p>
              {c.description && (
                <p className="mt-3 text-sm text-muted-foreground">{c.description}</p>
              )}
              <div className="mt-6 flex gap-5 text-[11px] font-semibold uppercase tracking-[0.16em]">
                <button className="link-underline" onClick={() => openEdit(c)}>
                  Editar
                </button>
                <button
                  className="link-underline text-muted-foreground"
                  onClick={() => void remove(c.id)}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {editing ? "Editar categoria" : "Nova categoria"}
            </DialogTitle>
          </DialogHeader>
          <form className="mt-6 space-y-5" onSubmit={(e) => void save(e)}>
            <div className="space-y-2">
              <Label htmlFor="c-name" className="text-[11px] uppercase tracking-[0.16em]">
                Nome
              </Label>
              <Input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 rounded-none border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-desc" className="text-[11px] uppercase tracking-[0.16em]">
                Descrição (opcional)
              </Label>
              <Textarea
                id="c-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-none border-border"
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
