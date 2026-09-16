/**
 * A "how this works" panel. Built on <details> so it is a plain server
 * component with no JavaScript, stays open by default the first time someone
 * reads a screen, and folds away once they know it.
 */
export const HelpBox = ({
  title,
  intro,
  steps,
  tips,
  defaultOpen = true,
}: {
  title: string;
  intro?: string;
  steps?: readonly string[];
  tips?: readonly string[];
  defaultOpen?: boolean;
}) => (
  <details
    open={defaultOpen}
    className="group rounded-lg border border-border bg-secondary text-sm text-secondary-foreground [&_summary::-webkit-details-marker]:hidden"
  >
    <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 font-medium">
      <span
        aria-hidden
        className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
      >
        ?
      </span>
      {title}
      <span className="ml-auto text-xs font-normal text-primary group-open:hidden">
        Afficher l&apos;aide
      </span>
      <span className="ml-auto hidden text-xs font-normal text-primary group-open:inline">
        Masquer
      </span>
    </summary>

    <div className="space-y-3 border-t border-border px-4 py-3">
      {intro && <p className="leading-relaxed">{intro}</p>}

      {steps && steps.length > 0 && (
        <ol className="space-y-1.5">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-card text-[11px] font-semibold text-primary">
                {index + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {tips && tips.length > 0 && (
        <ul className="space-y-1 rounded-md bg-card/70 px-3 py-2 text-[13px] text-secondary-foreground">
          {tips.map((tip) => (
            <li key={tip} className="flex gap-2">
              <span aria-hidden className="text-amber-600">
                ★
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </details>
);

/** Small inline hint under a single field. */
export const FieldHint = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-1 text-xs leading-snug text-zinc-500">{children}</p>
);
