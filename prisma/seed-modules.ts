import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import type {
  Customer,
  CustomerGroup,
  StockItem,
  Supplier,
  SupplierGroup,
  Territory,
  Warehouse,
} from "../src/generated/prisma/client";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Demo data for the purchasing, selling and stock modules.
 *
 * Idempotent: every document is keyed on a stable number, so re-running tops
 * the data up rather than duplicating it. Accounting is deliberately left
 * alone — its books should only ever be written by posting journals.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to your .env file.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysAhead = (n: number) => new Date(Date.now() + n * DAY);

const main = async () => {
  const restaurant = await prisma.restaurant.findFirst({
    select: { id: true, name: true, ownerId: true },
  });
  if (!restaurant) throw new Error("No restaurant found — onboard one first.");
  const rid = restaurant.id;
  const uid = restaurant.ownerId;
  console.log(`Seeding modules for ${restaurant.name}`);

  // ------------------------------------------------------------ warehouses ---
  const warehouseSpecs = [
    { name: "Main store", code: "MAIN", isDefault: true },
    { name: "Cold room", code: "COLD", isDefault: false },
    { name: "Bar", code: "BAR", isDefault: false },
  ];
  const warehouses: Warehouse[] = [];
  for (const spec of warehouseSpecs) {
    warehouses.push(
      await prisma.warehouse.upsert({
        where: { restaurantId_name: { restaurantId: rid, name: spec.name } },
        create: { restaurantId: rid, ...spec, city: "Cotonou" },
        update: {},
      }),
    );
  }
  const [mainStore, coldRoom, bar] = warehouses;

  // ----------------------------------------------------------- stock items ---
  const itemSpecs = [
    {
      name: "Rice",
      unit: "KG" as const,
      category: "Dry goods",
      cost: 850,
      reorder: 40,
    },
    {
      name: "Chicken",
      unit: "KG" as const,
      category: "Meat",
      cost: 2600,
      reorder: 25,
    },
    {
      name: "Tomatoes",
      unit: "KG" as const,
      category: "Produce",
      cost: 700,
      reorder: 15,
    },
    {
      name: "Onions",
      unit: "KG" as const,
      category: "Produce",
      cost: 550,
      reorder: 15,
    },
    {
      name: "Cooking oil",
      unit: "LITRE" as const,
      category: "Dry goods",
      cost: 1200,
      reorder: 20,
    },
    {
      name: "Beer",
      unit: "BOTTLE" as const,
      category: "Drinks",
      cost: 450,
      reorder: 60,
    },
    {
      name: "Soft drinks",
      unit: "BOTTLE" as const,
      category: "Drinks",
      cost: 300,
      reorder: 60,
    },
    {
      name: "Fish",
      unit: "KG" as const,
      category: "Seafood",
      cost: 3100,
      reorder: 12,
    },
  ];
  const items: StockItem[] = [];
  for (const spec of itemSpecs) {
    items.push(
      await prisma.stockItem.upsert({
        where: { restaurantId_name: { restaurantId: rid, name: spec.name } },
        create: {
          restaurantId: rid,
          name: spec.name,
          unit: spec.unit,
          category: spec.category,
          costPerUnit: spec.cost,
          reorderLevel: spec.reorder,
          parLevel: spec.reorder * 3,
          onHand: 0,
        },
        update: { costPerUnit: spec.cost, reorderLevel: spec.reorder },
      }),
    );
  }

  // ------------------------------------------------------- supplier groups ---
  const groupSpecs = [
    { name: "Produce", days: 7 },
    { name: "Wholesale", days: 30 },
    { name: "Drinks", days: 15 },
  ];
  const supplierGroups: SupplierGroup[] = [];
  for (const g of groupSpecs) {
    supplierGroups.push(
      await prisma.supplierGroup.upsert({
        where: { restaurantId_name: { restaurantId: rid, name: g.name } },
        create: {
          restaurantId: rid,
          name: g.name,
          defaultPaymentTermsDays: g.days,
        },
        update: {},
      }),
    );
  }

  // ------------------------------------------------------------- suppliers ---
  const supplierSpecs = [
    {
      code: "SUP-00001",
      name: "Marché Dantokpa",
      group: 0,
      phone: "+22997000001",
      terms: 7,
      city: "Cotonou",
    },
    {
      code: "SUP-00002",
      name: "Grossiste Akpakpa",
      group: 1,
      phone: "+22997000002",
      terms: 30,
      city: "Cotonou",
    },
    {
      code: "SUP-00003",
      name: "Brasserie du Bénin",
      group: 2,
      phone: "+22997000003",
      terms: 15,
      city: "Cotonou",
    },
    {
      code: "SUP-00004",
      name: "Pêcherie Atlantique",
      group: 0,
      phone: "+22997000004",
      terms: 7,
      city: "Ouidah",
    },
  ];
  const suppliers: Supplier[] = [];
  for (const s of supplierSpecs) {
    suppliers.push(
      await prisma.supplier.upsert({
        where: { restaurantId_code: { restaurantId: rid, code: s.code } },
        create: {
          restaurantId: rid,
          code: s.code,
          name: s.name,
          supplierGroupId: supplierGroups[s.group].id,
          phone: s.phone,
          city: s.city,
          country: "BJ",
          currency: "XOF",
          paymentTermsDays: s.terms,
        },
        update: {},
      }),
    );
  }

  // ------------------------------------------------------- customer groups ---
  const custGroups: CustomerGroup[] = [];
  for (const name of ["Hotels", "Corporate", "Events"]) {
    custGroups.push(
      await prisma.customerGroup.upsert({
        where: { restaurantId_name: { restaurantId: rid, name } },
        create: { restaurantId: rid, name, defaultPaymentTermsDays: 30 },
        update: {},
      }),
    );
  }
  const territories: Territory[] = [];
  for (const name of ["Cotonou", "Porto-Novo", "Abomey-Calavi"]) {
    territories.push(
      await prisma.territory.upsert({
        where: { restaurantId_name: { restaurantId: rid, name } },
        create: { restaurantId: rid, name },
        update: {},
      }),
    );
  }

  // ------------------------------------------------------------- customers ---
  const customerSpecs = [
    {
      code: "CUST-00001",
      name: "Hôtel du Lac",
      group: 0,
      terr: 0,
      limit: 2_000_000,
      phone: "+22996000001",
    },
    {
      code: "CUST-00002",
      name: "Banque Atlantique",
      group: 1,
      terr: 0,
      limit: 5_000_000,
      phone: "+22996000002",
    },
    {
      code: "CUST-00003",
      name: "Traiteur Événements Plus",
      group: 2,
      terr: 2,
      limit: 800_000,
      phone: "+22996000003",
    },
    {
      code: "CUST-00004",
      name: "Résidence Porto",
      group: 0,
      terr: 1,
      limit: 1_200_000,
      phone: "+22996000004",
    },
  ];
  const customers: Customer[] = [];
  for (const c of customerSpecs) {
    customers.push(
      await prisma.customer.upsert({
        where: { restaurantId_code: { restaurantId: rid, code: c.code } },
        create: {
          restaurantId: rid,
          code: c.code,
          name: c.name,
          customerGroupId: custGroups[c.group].id,
          territoryId: territories[c.terr].id,
          phone: c.phone,
          city: territories[c.terr].name,
          country: "BJ",
          currency: "XOF",
          paymentTermsDays: 30,
          creditLimit: c.limit,
        },
        update: {},
      }),
    );
  }

  // Claim document numbers past whatever the seed uses, so live documents
  // created afterwards never collide with these.
  const bumpSequence = async (docType: string, to: number) => {
    await prisma.documentSequence.upsert({
      where: { restaurantId_docType: { restaurantId: rid, docType } },
      create: { restaurantId: rid, docType, nextValue: to },
      update: { nextValue: to },
    });
  };

  // -------------------------------------------------------- purchase chain ---
  const poSpecs = [
    {
      n: "PO-90001",
      sup: 1,
      days: 24,
      sched: 20,
      lines: [
        [0, 100],
        [4, 40],
      ] as [number, number][],
      status: "COMPLETED",
    },
    {
      n: "PO-90002",
      sup: 0,
      days: 12,
      sched: 10,
      lines: [
        [2, 30],
        [3, 25],
      ] as [number, number][],
      status: "TO_BILL",
    },
    {
      n: "PO-90003",
      sup: 2,
      days: 8,
      sched: 5,
      lines: [
        [5, 240],
        [6, 180],
      ] as [number, number][],
      status: "TO_RECEIVE_AND_BILL",
    },
    {
      n: "PO-90004",
      sup: 3,
      days: 3,
      sched: -2,
      lines: [[7, 20]] as [number, number][],
      status: "TO_RECEIVE_AND_BILL",
    },
    {
      n: "PO-90005",
      sup: 1,
      days: 1,
      sched: 6,
      lines: [[1, 45]] as [number, number][],
      status: "DRAFT",
    },
  ];

  for (const spec of poSpecs) {
    const existing = await prisma.purchaseOrder.findUnique({
      where: { restaurantId_number: { restaurantId: rid, number: spec.n } },
    });
    if (existing) continue;

    const lines = spec.lines.map(([idx, qty], i) => {
      const item = items[idx];
      const rate = Number(item.costPerUnit ?? 1000);
      return {
        stockItemId: item.id,
        quantity: qty,
        rate,
        taxRate: 18,
        amount: qty * rate,
        sortOrder: i,
        receivedQty:
          spec.status === "COMPLETED" || spec.status === "TO_BILL" ? qty : 0,
        billedQty: spec.status === "COMPLETED" ? qty : 0,
      };
    });
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const taxTotal = Math.round(subtotal * 0.18 * 100) / 100;

    const po = await prisma.purchaseOrder.create({
      data: {
        restaurantId: rid,
        createdById: uid,
        number: spec.n,
        supplierId: suppliers[spec.sup].id,
        transactionDate: daysAgo(spec.days),
        scheduleDate: daysAhead(spec.sched),
        status: spec.status as never,
        currency: "XOF",
        subtotal,
        taxTotal,
        grandTotal: subtotal + taxTotal,
        receivedPercent:
          spec.status === "COMPLETED" || spec.status === "TO_BILL" ? 100 : 0,
        billedPercent: spec.status === "COMPLETED" ? 100 : 0,
        submittedAt: spec.status === "DRAFT" ? null : daysAgo(spec.days),
        items: { create: lines },
      },
      include: { items: true },
    });

    // A received order gets a goods receipt, which is what moves the stock.
    if (spec.status === "COMPLETED" || spec.status === "TO_BILL") {
      const receipt = await prisma.purchaseReceipt.create({
        data: {
          restaurantId: rid,
          createdById: uid,
          number: spec.n.replace("PO-9", "PR-9"),
          supplierId: po.supplierId,
          purchaseOrderId: po.id,
          postingDate: daysAgo(spec.days - 2),
          status: spec.status === "COMPLETED" ? "COMPLETED" : "TO_BILL",
          subtotal,
          taxTotal,
          grandTotal: subtotal + taxTotal,
          billedPercent: spec.status === "COMPLETED" ? 100 : 0,
          submittedAt: daysAgo(spec.days - 2),
          items: {
            create: po.items.map((line, i) => ({
              stockItemId: line.stockItemId,
              purchaseOrderItemId: line.id,
              quantity: Number(line.quantity),
              rate: Number(line.rate),
              taxRate: 18,
              amount: Number(line.amount),
              billedQty:
                spec.status === "COMPLETED" ? Number(line.quantity) : 0,
              sortOrder: i,
            })),
          },
        },
        include: { items: true },
      });

      // Move the stock the way the app does: ledger row plus bin, in step.
      for (const line of receipt.items) {
        const qty = Number(line.quantity);
        const updated = await prisma.stockItem.update({
          where: { id: line.stockItemId },
          data: { onHand: { increment: qty } },
          select: { onHand: true },
        });
        await prisma.stockMovement.create({
          data: {
            restaurantId: rid,
            stockItemId: line.stockItemId,
            type: "RECEIVE",
            quantity: qty,
            resultingOnHand: updated.onHand,
            reason: "Purchase receipt",
            note: receipt.number,
            warehouseId: mainStore.id,
            purchaseReceiptItemId: line.id,
            createdById: uid,
          },
        });
        const rate = Number(line.rate);
        await prisma.bin.upsert({
          where: {
            stockItemId_warehouseId: {
              stockItemId: line.stockItemId,
              warehouseId: mainStore.id,
            },
          },
          create: {
            restaurantId: rid,
            stockItemId: line.stockItemId,
            warehouseId: mainStore.id,
            actualQty: qty,
            projectedQty: qty,
            valuationRate: rate,
            stockValue: qty * rate,
          },
          update: {
            actualQty: { increment: qty },
            projectedQty: { increment: qty },
            valuationRate: rate,
            stockValue: { increment: qty * rate },
          },
        });
      }

      // A completed order is billed and paid; a to-bill one waits.
      if (spec.status === "COMPLETED") {
        const invoice = await prisma.purchaseInvoice.create({
          data: {
            restaurantId: rid,
            createdById: uid,
            number: spec.n.replace("PO-9", "PI-9"),
            supplierInvoiceNo: `F-${spec.n.slice(-4)}`,
            supplierId: po.supplierId,
            purchaseOrderId: po.id,
            purchaseReceiptId: receipt.id,
            postingDate: daysAgo(spec.days - 3),
            dueDate: daysAgo(spec.days - 33),
            status: "PAID",
            currency: "XOF",
            subtotal,
            taxTotal,
            grandTotal: subtotal + taxTotal,
            paidAmount: subtotal + taxTotal,
            outstandingAmount: 0,
            submittedAt: daysAgo(spec.days - 3),
            items: {
              create: po.items.map((line, i) => ({
                stockItemId: line.stockItemId,
                purchaseOrderItemId: line.id,
                quantity: Number(line.quantity),
                rate: Number(line.rate),
                taxRate: 18,
                amount: Number(line.amount),
                sortOrder: i,
              })),
            },
          },
        });
        await prisma.supplierPayment.create({
          data: {
            restaurantId: rid,
            createdById: uid,
            number: spec.n.replace("PO-9", "PAY-9"),
            supplierId: po.supplierId,
            paymentDate: daysAgo(spec.days - 5),
            mode: "BANK_TRANSFER",
            amount: subtotal + taxTotal,
            unallocatedAmount: 0,
            referenceNo: `VIR-${spec.n.slice(-4)}`,
            allocations: {
              create: [
                { purchaseInvoiceId: invoice.id, amount: subtotal + taxTotal },
              ],
            },
          },
        });
      }
    }
  }

  // An unpaid, overdue supplier bill so the payables screen has something red.
  const overdueNumber = "PI-90099";
  if (
    !(await prisma.purchaseInvoice.findUnique({
      where: {
        restaurantId_number: { restaurantId: rid, number: overdueNumber },
      },
    }))
  ) {
    const sub = 420_000;
    const tax = Math.round(sub * 0.18);
    await prisma.purchaseInvoice.create({
      data: {
        restaurantId: rid,
        createdById: uid,
        number: overdueNumber,
        supplierInvoiceNo: "F-2291",
        supplierId: suppliers[2].id,
        postingDate: daysAgo(52),
        dueDate: daysAgo(22),
        status: "OVERDUE",
        currency: "XOF",
        subtotal: sub,
        taxTotal: tax,
        grandTotal: sub + tax,
        outstandingAmount: sub + tax,
        submittedAt: daysAgo(52),
        items: {
          create: [
            {
              stockItemId: items[5].id,
              quantity: 600,
              rate: 450,
              taxRate: 18,
              amount: 270_000,
              sortOrder: 0,
            },
            {
              stockItemId: items[6].id,
              quantity: 500,
              rate: 300,
              taxRate: 18,
              amount: 150_000,
              sortOrder: 1,
            },
          ],
        },
      },
    });
  }

  // ----------------------------------------------------------- sales chain ---
  const soSpecs = [
    {
      n: "SO-90001",
      cus: 0,
      days: 20,
      del: -14,
      lines: [["Buffet lunch (per head)", 60, 7500]] as [
        string,
        number,
        number,
      ][],
      status: "COMPLETED",
    },
    {
      n: "SO-90002",
      cus: 1,
      days: 12,
      del: -6,
      lines: [["Office catering tray", 25, 12000]] as [
        string,
        number,
        number,
      ][],
      status: "TO_BILL",
    },
    {
      n: "SO-90003",
      cus: 2,
      days: 5,
      del: 9,
      lines: [["Wedding menu (per head)", 150, 9500]] as [
        string,
        number,
        number,
      ][],
      status: "TO_DELIVER_AND_BILL",
    },
    {
      n: "SO-90004",
      cus: 3,
      days: 2,
      del: -1,
      lines: [["Weekly meal plan", 40, 5500]] as [string, number, number][],
      status: "TO_DELIVER_AND_BILL",
    },
  ];

  for (const spec of soSpecs) {
    if (
      await prisma.salesOrder.findUnique({
        where: { restaurantId_number: { restaurantId: rid, number: spec.n } },
      })
    ) {
      continue;
    }

    const delivered = spec.status === "COMPLETED" || spec.status === "TO_BILL";
    const lines = spec.lines.map(([name, qty, rate], i) => ({
      itemName: name,
      quantity: qty,
      rate,
      taxRate: 18,
      amount: qty * rate,
      sortOrder: i,
      deliveredQty: delivered ? qty : 0,
      billedQty: spec.status === "COMPLETED" ? qty : 0,
    }));
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const taxTotal = Math.round(subtotal * 0.18);

    const so = await prisma.salesOrder.create({
      data: {
        restaurantId: rid,
        createdById: uid,
        number: spec.n,
        customerId: customers[spec.cus].id,
        transactionDate: daysAgo(spec.days),
        deliveryDate: daysAhead(spec.del),
        status: spec.status as never,
        currency: "XOF",
        subtotal,
        taxTotal,
        grandTotal: subtotal + taxTotal,
        deliveredPercent: delivered ? 100 : 0,
        billedPercent: spec.status === "COMPLETED" ? 100 : 0,
        poNumber: `BC-${spec.n.slice(-4)}`,
        submittedAt: daysAgo(spec.days),
        items: { create: lines },
      },
      include: { items: true },
    });

    if (delivered) {
      const note = await prisma.deliveryNote.create({
        data: {
          restaurantId: rid,
          createdById: uid,
          number: spec.n.replace("SO-9", "DN-9"),
          customerId: so.customerId,
          salesOrderId: so.id,
          warehouseId: mainStore.id,
          postingDate: daysAgo(spec.days - 2),
          status: spec.status === "COMPLETED" ? "COMPLETED" : "TO_BILL",
          subtotal,
          taxTotal,
          grandTotal: subtotal + taxTotal,
          billedPercent: spec.status === "COMPLETED" ? 100 : 0,
          driverName: "Koffi",
          vehicleNo: "AB-1234-RB",
          submittedAt: daysAgo(spec.days - 2),
          items: {
            create: so.items.map((line, i) => ({
              salesOrderItemId: line.id,
              itemName: line.itemName,
              quantity: Number(line.quantity),
              rate: Number(line.rate),
              taxRate: 18,
              amount: Number(line.amount),
              billedQty:
                spec.status === "COMPLETED" ? Number(line.quantity) : 0,
              sortOrder: i,
            })),
          },
        },
        include: { items: true },
      });

      if (spec.status === "COMPLETED") {
        const invoice = await prisma.salesInvoice.create({
          data: {
            restaurantId: rid,
            createdById: uid,
            number: spec.n.replace("SO-9", "SINV-9"),
            customerId: so.customerId,
            salesOrderId: so.id,
            deliveryNoteId: note.id,
            postingDate: daysAgo(spec.days - 3),
            dueDate: daysAhead(30 - spec.days),
            status: "PAID",
            currency: "XOF",
            subtotal,
            taxTotal,
            grandTotal: subtotal + taxTotal,
            paidAmount: subtotal + taxTotal,
            outstandingAmount: 0,
            submittedAt: daysAgo(spec.days - 3),
            items: {
              create: note.items.map((line, i) => ({
                salesOrderItemId: line.salesOrderItemId,
                deliveryNoteItemId: line.id,
                itemName: line.itemName,
                quantity: Number(line.quantity),
                rate: Number(line.rate),
                taxRate: 18,
                amount: Number(line.amount),
                sortOrder: i,
              })),
            },
          },
        });
        await prisma.customerPayment.create({
          data: {
            restaurantId: rid,
            createdById: uid,
            number: spec.n.replace("SO-9", "REC-9"),
            customerId: so.customerId,
            paymentDate: daysAgo(spec.days - 6),
            mode: "MOBILE_MONEY",
            amount: subtotal + taxTotal,
            unallocatedAmount: 0,
            referenceNo: `MM-${spec.n.slice(-4)}`,
            allocations: {
              create: [
                { salesInvoiceId: invoice.id, amount: subtotal + taxTotal },
              ],
            },
          },
        });
      }
    }
  }

  // An unpaid customer bill, overdue, so receivables show something red.
  const openInvoice = "SINV-90099";
  if (
    !(await prisma.salesInvoice.findUnique({
      where: {
        restaurantId_number: { restaurantId: rid, number: openInvoice },
      },
    }))
  ) {
    const sub = 780_000;
    const tax = Math.round(sub * 0.18);
    await prisma.salesInvoice.create({
      data: {
        restaurantId: rid,
        createdById: uid,
        number: openInvoice,
        customerId: customers[0].id,
        postingDate: daysAgo(48),
        dueDate: daysAgo(18),
        status: "OVERDUE",
        currency: "XOF",
        subtotal: sub,
        taxTotal: tax,
        grandTotal: sub + tax,
        paidAmount: 200_000,
        outstandingAmount: sub + tax - 200_000,
        submittedAt: daysAgo(48),
        items: {
          create: [
            {
              itemName: "Conference catering — 3 days",
              quantity: 3,
              rate: 260_000,
              taxRate: 18,
              amount: 780_000,
              sortOrder: 0,
            },
          ],
        },
      },
    });
  }

  // Sales quotations, including one that was lost.
  const quoteSpecs = [
    { n: "QTN-90001", cus: 1, status: "ORDERED", total: 300_000, days: 30 },
    { n: "QTN-90002", cus: 2, status: "OPEN", total: 1_425_000, days: 4 },
    {
      n: "QTN-90003",
      cus: 3,
      status: "LOST",
      total: 220_000,
      days: 18,
      lost: "Price too high",
    },
  ];
  for (const q of quoteSpecs) {
    if (
      await prisma.salesQuotation.findUnique({
        where: { restaurantId_number: { restaurantId: rid, number: q.n } },
      })
    ) {
      continue;
    }
    const tax = Math.round(q.total * 0.18);
    await prisma.salesQuotation.create({
      data: {
        restaurantId: rid,
        createdById: uid,
        number: q.n,
        customerId: customers[q.cus].id,
        transactionDate: daysAgo(q.days),
        validUntil: daysAhead(30 - q.days),
        status: q.status as never,
        currency: "XOF",
        subtotal: q.total,
        taxTotal: tax,
        grandTotal: q.total + tax,
        lostReason: q.lost ?? null,
        submittedAt: daysAgo(q.days),
        items: {
          create: [
            {
              itemName: "Catering package",
              quantity: 1,
              rate: q.total,
              taxRate: 18,
              amount: q.total,
              sortOrder: 0,
            },
          ],
        },
      },
    });
  }

  // ------------------------------------------------------- stock documents ---
  const batchSpecs = [
    { item: 1, no: "CHK-2026-11", expiry: 4, qty: 18 },
    { item: 7, no: "FSH-2026-07", expiry: 2, qty: 9 },
    { item: 5, no: "BR-2026-44", expiry: 180, qty: 240 },
    { item: 2, no: "TOM-2026-19", expiry: -1, qty: 4 },
  ];
  for (const b of batchSpecs) {
    await prisma.batch.upsert({
      where: {
        stockItemId_batchNo: { stockItemId: items[b.item].id, batchNo: b.no },
      },
      create: {
        restaurantId: rid,
        stockItemId: items[b.item].id,
        warehouseId: b.item === 5 ? bar.id : coldRoom.id,
        batchNo: b.no,
        expiryDate: daysAhead(b.expiry),
        manufactureDate: daysAgo(10),
        quantity: b.qty,
      },
      update: {},
    });
  }

  const mrSpecs = [
    {
      n: "MR-90001",
      type: "PURCHASE",
      status: "ORDERED",
      days: 10,
      req: 3,
      lines: [[1, 40]] as [number, number][],
    },
    {
      n: "MR-90002",
      type: "MATERIAL_TRANSFER",
      status: "PENDING",
      days: 2,
      req: -1,
      lines: [
        [5, 120],
        [6, 90],
      ] as [number, number][],
    },
    {
      n: "MR-90003",
      type: "MATERIAL_ISSUE",
      status: "PENDING",
      days: 1,
      req: 5,
      lines: [[0, 25]] as [number, number][],
    },
  ];
  for (const mr of mrSpecs) {
    if (
      await prisma.materialRequest.findUnique({
        where: { restaurantId_number: { restaurantId: rid, number: mr.n } },
      })
    ) {
      continue;
    }
    await prisma.materialRequest.create({
      data: {
        restaurantId: rid,
        requestedById: uid,
        number: mr.n,
        type: mr.type as never,
        status: mr.status as never,
        transactionDate: daysAgo(mr.days),
        requiredBy: daysAhead(mr.req),
        submittedAt: daysAgo(mr.days),
        items: {
          create: mr.lines.map(([idx, qty], i) => ({
            stockItemId: items[idx].id,
            warehouseId: mainStore.id,
            quantity: qty,
            orderedQty: mr.status === "ORDERED" ? qty : 0,
            sortOrder: i,
          })),
        },
      },
    });
  }

  // A submitted transfer: bar stock moved out of the main store.
  const transferNumber = "STE-90001";
  if (
    !(await prisma.stockEntry.findUnique({
      where: {
        restaurantId_number: { restaurantId: rid, number: transferNumber },
      },
    }))
  ) {
    const moves: [number, number][] = [
      [5, 90],
      [6, 60],
    ];
    const entry = await prisma.stockEntry.create({
      data: {
        restaurantId: rid,
        createdById: uid,
        number: transferNumber,
        purpose: "MATERIAL_TRANSFER",
        status: "SUBMITTED",
        postingDate: daysAgo(4),
        submittedAt: daysAgo(4),
        reason: "Restock the bar",
        totalValue: moves.reduce(
          (s, [idx, qty]) => s + qty * Number(items[idx].costPerUnit ?? 0),
          0,
        ),
        items: {
          create: moves.map(([idx, qty], i) => {
            const rate = Number(items[idx].costPerUnit ?? 0);
            return {
              stockItemId: items[idx].id,
              fromWarehouseId: mainStore.id,
              toWarehouseId: bar.id,
              quantity: qty,
              valuationRate: rate,
              amount: qty * rate,
              sortOrder: i,
            };
          }),
        },
      },
      include: { items: true },
    });

    // A transfer changes where stock sits, never the overall on-hand.
    for (const line of entry.items) {
      const qty = Number(line.quantity);
      const rate = Number(line.valuationRate);
      await prisma.bin.updateMany({
        where: { stockItemId: line.stockItemId, warehouseId: mainStore.id },
        data: {
          actualQty: { decrement: qty },
          projectedQty: { decrement: qty },
          stockValue: { decrement: qty * rate },
        },
      });
      await prisma.bin.upsert({
        where: {
          stockItemId_warehouseId: {
            stockItemId: line.stockItemId,
            warehouseId: bar.id,
          },
        },
        create: {
          restaurantId: rid,
          stockItemId: line.stockItemId,
          warehouseId: bar.id,
          actualQty: qty,
          projectedQty: qty,
          valuationRate: rate,
          stockValue: qty * rate,
        },
        update: {
          actualQty: { increment: qty },
          projectedQty: { increment: qty },
          stockValue: { increment: qty * rate },
        },
      });
    }
  }

  await bumpSequence("PO", 90_100);
  await bumpSequence("PREC", 90_100);
  await bumpSequence("PINV", 90_100);
  await bumpSequence("PPAY", 90_100);
  await bumpSequence("SO", 90_100);
  await bumpSequence("DN", 90_100);
  await bumpSequence("SINV", 90_100);
  await bumpSequence("CPAY", 90_100);
  await bumpSequence("SQTE", 90_100);
  await bumpSequence("MREQ", 90_100);
  await bumpSequence("STE", 90_100);

  const summary = {
    warehouses: await prisma.warehouse.count({ where: { restaurantId: rid } }),
    stockItems: await prisma.stockItem.count({ where: { restaurantId: rid } }),
    suppliers: await prisma.supplier.count({ where: { restaurantId: rid } }),
    purchaseOrders: await prisma.purchaseOrder.count({
      where: { restaurantId: rid },
    }),
    purchaseInvoices: await prisma.purchaseInvoice.count({
      where: { restaurantId: rid },
    }),
    customers: await prisma.customer.count({ where: { restaurantId: rid } }),
    salesOrders: await prisma.salesOrder.count({
      where: { restaurantId: rid },
    }),
    salesInvoices: await prisma.salesInvoice.count({
      where: { restaurantId: rid },
    }),
    batches: await prisma.batch.count({ where: { restaurantId: rid } }),
    bins: await prisma.bin.count({ where: { restaurantId: rid } }),
  };
  console.table(summary);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
