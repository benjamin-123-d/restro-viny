/** LOUD pill marking a guest self-order (distinct from staff-placed tickets). */
export function SelfOrderBadge({ className }: { readonly className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs font-bold tracking-wide text-primary-foreground uppercase ring-1 ring-primary${className ? ` ${className}` : ""}`}
    >
      Self-order
    </span>
  );
}
