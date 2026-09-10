import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { hashStaffPin } from "../src/lib/staff-pin";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to your .env file.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const OWNER_PHONE = "+2290162702152";

/** Carte de demonstration : categorie -> plats (nom, prix FCFA, type dietetique). */
const CARTE: Array<{
  categorie: string;
  description: string;
  plats: Array<[string, number, "VEG" | "NON_VEG" | "EGG", string]>;
}> = [
  {
    categorie: "Entrees",
    description: "Pour commencer le repas",
    plats: [
      ["Salade d'avocat", 2500, "VEG", "Avocat frais, tomates, oignons"],
      ["Beignets de crevettes", 3500, "NON_VEG", "Crevettes panees, sauce piquante"],
      ["Soupe d'arachide", 2000, "VEG", "Soupe traditionnelle a l'arachide"],
    ],
  },
  {
    categorie: "Plats principaux",
    description: "Nos specialites",
    plats: [
      ["Poulet DG", 6500, "NON_VEG", "Poulet saute, plantains, legumes"],
      ["Poisson braise", 7000, "NON_VEG", "Poisson entier braise, attieke"],
      ["Riz au gras", 4500, "NON_VEG", "Riz mijote a la viande"],
      ["Igname pilee sauce arachide", 5000, "VEG", "Igname pilee, sauce arachide"],
      ["Amiwo au poulet", 5500, "NON_VEG", "Pate rouge beninoise, poulet"],
      ["Atassi haricot-riz", 3500, "VEG", "Riz et haricots, sauce tomate"],
    ],
  },
  {
    categorie: "Accompagnements",
    description: "A cote du plat",
    plats: [
      ["Attieke", 1500, "VEG", "Semoule de manioc"],
      ["Plantains frits (aloco)", 1500, "VEG", "Plantains murs frits"],
      ["Frites de patate douce", 2000, "VEG", "Patates douces frites"],
    ],
  },
  {
    categorie: "Boissons",
    description: "Fraiches et locales",
    plats: [
      ["Jus de bissap", 1000, "VEG", "Hibiscus glace"],
      ["Jus de gingembre", 1000, "VEG", "Gingembre frais presse"],
      ["Eau minerale 50cl", 500, "VEG", "Bouteille d'eau"],
      ["Biere locale", 1500, "VEG", "Biere pression 33cl"],
      ["Sodabi", 2000, "VEG", "Alcool traditionnel de palme"],
    ],
  },
  {
    categorie: "Desserts",
    description: "Pour finir en douceur",
    plats: [
      ["Salade de fruits", 2000, "VEG", "Fruits de saison"],
      ["Degue", 1500, "VEG", "Mil et lait caille"],
      ["Ananas frais", 1000, "VEG", "Ananas de Allada"],
    ],
  },
];

const TABLES: Array<[string, number, string]> = [
  ["T1", 2, "Salle"],
  ["T2", 2, "Salle"],
  ["T3", 4, "Salle"],
  ["T4", 4, "Salle"],
  ["T5", 6, "Salle"],
  ["T6", 6, "Salle"],
  ["TER1", 4, "Terrasse"],
  ["TER2", 4, "Terrasse"],
  ["TER3", 8, "Terrasse"],
  ["VIP1", 10, "Salon prive"],
];

const STOCK: Array<[string, string, number, number, string, number]> = [
  // nom, unite (StockUnit), quantite en stock, seuil de reappro, categorie, cout unitaire FCFA
  ["Riz", "KG", 120, 20, "Feculents", 900],
  ["Poulet", "KG", 45, 10, "Viandes", 2800],
  ["Poisson frais", "KG", 30, 8, "Poissons", 3200],
  ["Huile", "LITRE", 60, 15, "Epicerie", 1200],
  ["Tomates", "KG", 25, 5, "Legumes", 700],
  ["Oignons", "KG", 30, 5, "Legumes", 600],
  ["Plantains", "PIECE", 150, 30, "Legumes", 100],
  ["Igname", "KG", 50, 10, "Feculents", 800],
  ["Arachide", "KG", 20, 5, "Epicerie", 1500],
  ["Attieke", "KG", 18, 4, "Feculents", 1000],
  ["Eau minerale 50cl", "BOTTLE", 200, 48, "Boissons", 250],
  ["Biere locale", "BOTTLE", 120, 24, "Boissons", 800],
];

const PERSONNEL: Array<[string, string, string, string, string]> = [
  // code, nom, role (StaffRole: WAITER | KITCHEN | MANAGEMENT), telephone, PIN caisse
  ["EMP001", "Kossi Adjovi", "MANAGEMENT", "+2290161000001", "1001"],
  ["EMP002", "Afiavi Sossou", "MANAGEMENT", "+2290161000002", "1002"],
  ["EMP003", "Rachidou Bello", "KITCHEN", "+2290161000003", "1003"],
  ["EMP004", "Marie Hounkpe", "WAITER", "+2290161000004", "1004"],
  ["EMP005", "Ismael Dossou", "WAITER", "+2290161000005", "1005"],
];

async function main(): Promise<void> {
  const owner = await prisma.user.findUnique({ where: { phone: OWNER_PHONE } });
  if (!owner) {
    throw new Error(`Aucun utilisateur avec le telephone ${OWNER_PHONE}.`);
  }

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "viny" },
    update: {},
    create: {
      name: "Restaurant Viny",
      slug: "viny",
      username: "viny",
      legalName: "Restaurant Viny SARL",
      tagline: "La cuisine beninoise, autrement",
      email: "contact@viny.bj",
      phone: OWNER_PHONE,
      city: "Cotonou",
      country: "BJ",
      timezone: "Africa/Porto-Novo",
      addressLine1: "Carre 1234, Quartier Ganhi",
      state: "Littoral",
      restaurantFormat: "CASUAL_DINING",
      cuisines: ["Beninoise", "Africaine", "Grillades"],
      seatingCapacity: 50,
      serviceDineIn: true,
      serviceTakeaway: true,
      serviceDelivery: true,
      defaultOrderType: "DINE_IN",
      selfOrderEnabled: true,
      brandColor: "#c2410c",
      invoiceFooterNote: "Merci de votre visite — Restaurant Viny, Cotonou",
      isActive: true,
      ownerId: owner.id,
    },
  });
  console.log(`Restaurant : ${restaurant.name} (slug: ${restaurant.slug})`);

  // ---- Carte ----
  let nbPlats = 0;
  for (const [i, bloc] of CARTE.entries()) {
    const categorie = await prisma.menuCategory.upsert({
      where: { restaurantId_name: { restaurantId: restaurant.id, name: bloc.categorie } },
      update: {},
      create: {
        restaurantId: restaurant.id,
        name: bloc.categorie,
        description: bloc.description,
        sortOrder: i,
      },
    });

    for (const [j, [nom, prix, diet, desc]] of bloc.plats.entries()) {
      const existe = await prisma.menuItem.findFirst({
        where: { restaurantId: restaurant.id, name: nom },
      });
      if (!existe) {
        await prisma.menuItem.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: categorie.id,
            name: nom,
            shortDescription: desc,
            price: prix,
            dietaryType: diet,
            itemType: "SERVED",
            sortOrder: j,
            isActive: true,
          },
        });
        nbPlats++;
      }
    }
  }
  console.log(`Carte      : ${CARTE.length} categories, ${nbPlats} plats crees`);

  // ---- Tables ----
  let nbTables = 0;
  for (const [k, [label, seats, section]] of TABLES.entries()) {
    await prisma.diningTable.upsert({
      where: { restaurantId_label: { restaurantId: restaurant.id, label } },
      update: {},
      create: {
        restaurantId: restaurant.id,
        label,
        seats,
        section,
        sortOrder: k,
        isActive: true,
      },
    });
    nbTables++;
  }
  console.log(`Tables     : ${nbTables}`);

  // ---- Stock ----
  let nbStock = 0;
  for (const [nom, unite, qte, seuil, categorie, cout] of STOCK) {
    const existe = await prisma.stockItem.findFirst({
      where: { restaurantId: restaurant.id, name: nom },
    });
    if (!existe) {
      await prisma.stockItem.create({
        data: {
          restaurantId: restaurant.id,
          name: nom,
          unit: unite as never,
          category: categorie,
          onHand: qte,
          reorderLevel: seuil,
          costPerUnit: cout,
          isActive: true,
        },
      });
      nbStock++;
    }
  }
  console.log(`Stock      : ${nbStock} articles`);

  // ---- Personnel ----
  let nbStaff = 0;
  for (const [code, nom, role, tel, pin] of PERSONNEL) {
    const existe = await prisma.staff.findFirst({
      where: { restaurantId: restaurant.id, employeeCode: code },
    });
    if (!existe) {
      await prisma.staff.create({
        data: {
          restaurantId: restaurant.id,
          employeeCode: code,
          name: nom,
          role: role as never,
          phone: tel,
          status: "ACTIVE",
          city: "Cotonou",
          joiningDate: new Date("2026-01-15"),
          pinHash: hashStaffPin(pin, restaurant.id),
        },
      });
      nbStaff++;
    }
  }
  console.log(`Personnel  : ${nbStaff}`);
  console.log("PIN caisse : " + PERSONNEL.map(([c, n, , , p]) => `${n} (${c}) = ${p}`).join(", "));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("\nDonnees de demonstration installees.");
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
