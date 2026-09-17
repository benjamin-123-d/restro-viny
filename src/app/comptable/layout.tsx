import Link from "next/link";

import { Toaster } from "@/components/ui/sonner";

export const metadata = { title: "Espace comptable — V Suite" };

/**
 * The accountant's own space. Deliberately bare: no restaurant sidebar, no POS,
 * no stock. They come for one job, and everything else on screen is a distraction
 * they would have to learn to ignore.
 */
export default function ComptableLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-svh">
      <header className="bg-card sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-3 lg:px-6">
        <Link href="/comptable" className="font-heading text-lg font-semibold">
          Espace comptable
        </Link>
        <Link href="/dashboard" className="text-muted-foreground text-sm hover:underline">
          Retour au restaurant
        </Link>
      </header>
      <main>{children}</main>
      <Toaster />
    </div>
  );
}
