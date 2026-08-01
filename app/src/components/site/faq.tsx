export function FAQ({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="mt-10 divide-y divide-border border-y border-border">
      {items.map(({ q, a }) => (
        <details key={q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-medium text-foreground">
            {q}
            <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 max-w-[68ch] text-[16px] leading-relaxed text-muted-foreground">{a}</p>
        </details>
      ))}
    </div>
  );
}
