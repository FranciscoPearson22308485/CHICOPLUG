import { Reveal } from "@/components/site/Reveal";

export type LegalSection = { title: string; body: string[] };

export function LegalPage({
  eyebrow,
  title,
  updated,
  sections,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <div className="shell pb-28 pt-16 md:pt-24">
      <Reveal>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-5 max-w-[20ch] text-5xl sm:text-6xl">{title}</h1>
        <p className="mt-8 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Atualizado em {updated}
        </p>
      </Reveal>

      <div className="mt-20 max-w-2xl space-y-14">
        {sections.map((s, i) => (
          <Reveal key={s.title} delay={i * 60}>
            <h2 className="text-xl">{s.title}</h2>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground">
              {s.body.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
