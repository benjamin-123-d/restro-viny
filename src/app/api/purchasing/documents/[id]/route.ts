import { getManagerContextOrNull } from "@/lib/manager-auth";
import { can } from "@/lib/permissions";
import { resolveAccess } from "@/services/access.service";
import { getPurchaseDocumentFile } from "@/services/supplier-documents.service";

/**
 * Serves an imported supplier document to someone allowed to read purchasing.
 * Inline by default so PDFs and photos open in the browser; `?download=1`
 * saves the file instead.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const ctx = await getManagerContextOrNull();
  if (!ctx) return new Response("Non connecté", { status: 401 });
  const access = await resolveAccess(ctx.userId, ctx.restaurantId);
  if (!access || !can(access, "PURCHASING", "READ")) {
    return new Response("Accès refusé", { status: 403 });
  }

  const { id } = await params;
  try {
    const file = await getPurchaseDocumentFile(ctx, id);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const ascii = file.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
    return new Response(new Uint8Array(file.content), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.content.byteLength),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Document introuvable", { status: 404 });
  }
}
