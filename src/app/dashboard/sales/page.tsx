import { permanentRedirect } from "next/navigation";

/**
 * The sales summary now lives in Statistiques → Ventes. Old links and
 * bookmarks keep working by landing there, period included.
 */
export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { periode } = await searchParams;
  permanentRedirect(`/dashboard/statistics/ventes${periode ? `?periode=${periode}` : ""}`);
}
