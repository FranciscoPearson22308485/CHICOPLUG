import { createFileRoute } from "@tanstack/react-router";
import { Instagram, Mail, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { Reveal } from "@/components/site/Reveal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/contacto")({
  head: () => ({
    meta: [
      { title: "Contacto — CHICOPLUG" },
      {
        name: "description",
        content: "Fala com a equipa CHICOPLUG: apoio ao cliente, encomendas, imprensa e parcerias.",
      },
      { property: "og:title", content: "Contacto — CHICOPLUG" },
      { property: "og:description", content: "Apoio ao cliente, imprensa e parcerias." },
    ],
  }),
  component: Contacto,
});

function Contacto() {
  return (
    <div className="shell pb-28 pt-16 md:pt-24">
      <Reveal>
        <p className="eyebrow">Fala connosco</p>
        <h1 className="mt-5 text-6xl sm:text-7xl">Contacto</h1>
      </Reveal>

      <div className="mt-20 grid gap-16 lg:grid-cols-2 lg:gap-24">
        <Reveal className="space-y-10">
          {[
            { icon: Mail, label: "Email", value: "ola@chicoplug.ao" },
            { icon: Phone, label: "Telefone", value: "+244 900 000 000" },
            { icon: Instagram, label: "Instagram", value: "@chicoplug" },
            { icon: MapPin, label: "Studio", value: "Talatona, Luanda — visitas por marcação" },
          ].map((item) => (
            <div
              key={item.label}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 border-b border-border pb-6"
            >
              <item.icon className="mt-1 size-5 shrink-0" />
              <div className="min-w-0">
                <p className="eyebrow">{item.label}</p>
                <p className="mt-2 text-base">{item.value}</p>
              </div>
            </div>
          ))}
        </Reveal>

        <Reveal delay={120}>
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("Mensagem enviada", { description: "Respondemos em 24 horas." });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="c-nome" className="text-[11px] uppercase tracking-[0.16em]">
                Nome
              </Label>
              <Input
                id="c-nome"
                className="h-12 rounded-none border-border"
                placeholder="Nome e apelido"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email" className="text-[11px] uppercase tracking-[0.16em]">
                Email
              </Label>
              <Input
                id="c-email"
                type="email"
                className="h-12 rounded-none border-border"
                placeholder="o.teu@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-msg" className="text-[11px] uppercase tracking-[0.16em]">
                Mensagem
              </Label>
              <Textarea
                id="c-msg"
                rows={6}
                className="rounded-none border-border"
                placeholder="Como podemos ajudar?"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-foreground py-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground"
            >
              Enviar mensagem
            </button>
          </form>
        </Reveal>
      </div>
    </div>
  );
}
