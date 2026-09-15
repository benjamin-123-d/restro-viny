import "dotenv/config";

import { SignJWT } from "jose";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import {
  attachPurchaseDocument,
  recordInvoiceFromDocument,
  recordQuotationFromDocument,
} from "@/services/supplier-documents.service";

/**
 * End-to-end check of supplier document import against the real database and
 * the running app: record an invoice and a quote from their totals, attach a
 * phone-sized photo and a PDF, then fetch both back through the authenticated
 * route. Everything it creates is marked "E2E-DOC" and removed with --purge.
 *
 *   npx tsx scripts/e2e-supplier-documents.ts [baseUrl] [--prod]
 *   npx tsx scripts/e2e-supplier-documents.ts --purge
 */

const MARK = "E2E-DOC";
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3000";

const purge = async (restaurantId: string) => {
  const invoices = await prisma.purchaseInvoice.deleteMany({ where: { restaurantId, notes: MARK } });
  const quotations = await prisma.supplierQuotation.deleteMany({ where: { restaurantId, notes: MARK } });
  console.log(`Supprimé : ${invoices.count} facture(s), ${quotations.count} devis de test.`);
};

const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
};

const main = async () => {
  const restaurant = await prisma.restaurant.findFirst({ select: { id: true, ownerId: true } });
  if (!restaurant) throw new Error("Aucun restaurant.");
  if (process.argv.includes("--purge")) return purge(restaurant.id);

  const supplier = await prisma.supplier.findFirst({
    where: { restaurantId: restaurant.id, deletedAt: null, disabled: false, onHold: false, preventRfq: false },
  });
  if (!supplier) throw new Error("Aucun fournisseur utilisable.");
  const ctx = { restaurantId: restaurant.id, userId: restaurant.ownerId };

  // A 4000 × 3000 photo with sensor noise: the size a phone camera hands over.
  const width = 4000;
  const height = 3000;
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = 200 + Math.floor(Math.random() * 55);
  const photo = await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");

  const invoice = await recordInvoiceFromDocument(ctx, {
    supplierId: supplier.id,
    supplierInvoiceNo: "FA-118",
    totalTTC: 211,
    vatRate: 5.5,
    notes: MARK,
    source: "PHOTO",
  });
  const stored = await prisma.purchaseInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
  check("facture enregistrée avec son seul total", stored.summaryOnly && Number(stored.subtotal) === 200 && Number(stored.taxTotal) === 11);

  const photoDoc = await attachPurchaseDocument(ctx, {
    kind: "INVOICE",
    parentId: invoice.id,
    source: "PHOTO",
    file: { buffer: photo, type: "image/jpeg", size: photo.byteLength, name: "IMG_2041.JPG" },
  });
  check("photo réduite avant stockage", photoDoc.sizeBytes < photo.byteLength, `${photo.byteLength} → ${photoDoc.sizeBytes} octets`);

  const quotation = await recordQuotationFromDocument(ctx, {
    supplierId: supplier.id,
    supplierReference: "DEV-553",
    totalTTC: 120,
    vatAmount: 20,
    notes: MARK,
    source: "EMAIL",
  });
  const pdfDoc = await attachPurchaseDocument(ctx, {
    kind: "QUOTATION",
    parentId: quotation.id,
    source: "EMAIL",
    file: { buffer: pdf, type: "application/pdf", size: pdf.byteLength, name: "devis-553.pdf" },
  });
  check("PDF de devis attaché tel quel", pdfDoc.sizeBytes === pdf.byteLength);

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(restaurant.ownerId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET ?? ""));

  for (const doc of [photoDoc, pdfDoc]) {
    const res = await fetch(`${BASE}${doc.url}`, { headers: { cookie: `restro_session=${token}` } });
    const body = Buffer.from(await res.arrayBuffer());
    check(`document servi : ${doc.fileName}`, res.ok && body.byteLength === doc.sizeBytes, `${res.status} ${res.headers.get("content-type")}`);
  }
  // `next dev` signs anonymous visitors in as DEV_ADMIN_USER_ID; only a
  // production server (e.g. the standalone build on :3100) can show refusal.
  if (process.argv.includes("--prod")) {
    const anonymous = await fetch(`${BASE}${pdfDoc.url}`, { redirect: "manual" });
    check("refusé sans session", [401, 302, 307].includes(anonymous.status), String(anonymous.status));
  }

  for (const path of [`/dashboard/purchasing/invoices/${invoice.id}`, `/dashboard/purchasing/quotations/${quotation.id}`]) {
    const res = await fetch(`${BASE}${path}`, { headers: { cookie: `restro_session=${token}` } });
    const html = await res.text();
    const expected = path.includes("invoices") ? photoDoc.fileName : pdfDoc.fileName;
    check(`fiche affichée : ${path}`, res.ok && html.includes(expected), String(res.status));
  }

  console.log(`\nFacture : ${invoice.id}\nDevis : ${quotation.id}\n(npx tsx scripts/e2e-supplier-documents.ts --purge pour nettoyer)`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
