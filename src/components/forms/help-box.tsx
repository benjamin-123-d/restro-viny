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
    className="group rounded-lg border border-blue-200 bg-blue-50/60 text-sm text-blue-950 [&_summary::-webkit-details-marker]:hidden"
  >
    <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 font-medium">
      <span
        aria-hidden
        className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
      >
        ?
      </span>
      {title}
      <span className="ml-auto text-xs font-normal text-blue-700 group-open:hidden">
        Afficher l&apos;aide
      </span>
      <span className="ml-auto hidden text-xs font-normal text-blue-700 group-open:inline">
        Masquer
      </span>
    </summary>

    <div className="space-y-3 border-t border-blue-200 px-4 py-3">
      {intro && <p className="leading-relaxed">{intro}</p>}

      {steps && steps.length > 0 && (
        <ol className="space-y-1.5">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-blue-300 bg-white text-[11px] font-semibold text-blue-700">
                {index + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {tips && tips.length > 0 && (
        <ul className="space-y-1 rounded-md bg-white/70 px-3 py-2 text-[13px] text-blue-900">
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
