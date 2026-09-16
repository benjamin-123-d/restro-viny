/**
 * Services throw stable codes ("SUPPLIER_BLOCKED"); people should read a
 * sentence. Unknown codes fall through unchanged so nothing is ever swallowed.
 */
const MESSAGES: Readonly<Record<string, string>> = {
  FORBIDDEN: "Vous n'avez pas le droit de modifier ce module. Demandez un rôle avec « Édition ».",
  NO_RESTAURANT: "Aucun restaurant n'est associé à votre compte.",
  "Validation failed": "Certains champs sont incomplets ou incorrects — voir en rouge ci-dessous.",

  SUPPLIER_NAME_TAKEN: "Un fournisseur porte déjà ce nom.",
  SUPPLIER_NOT_FOUND: "Fournisseur introuvable.",
  SUPPLIER_BLOCKED: "Ce fournisseur est bloqué (en attente ou commandes interdites).",
  CUSTOMER_NAME_TAKEN: "Un client porte déjà ce nom.",
  CUSTOMER_NOT_FOUND: "Client introuvable.",
  CUSTOMER_DISABLED: "Ce client est désactivé : on ne peut plus lui vendre.",
  CUSTOMER_OVER_CREDIT_LIMIT: "Cette commande dépasserait la limite de crédit du client.",

  PO_NOT_DRAFT: "Seul un brouillon peut être modifié.",
  PO_ALREADY_SUBMITTED: "Cette commande est déjà validée.",
  PO_HAS_RECEIPTS: "Des marchandises sont déjà reçues : faites un retour puis clôturez.",
  SO_NOT_DRAFT: "Seul un brouillon peut être modifié.",
  SO_HAS_DELIVERIES: "Des livraisons existent déjà : la commande ne peut plus être annulée.",
  SI_NOT_DRAFT: "Seule une facture en brouillon peut être validée ou supprimée.",
  SI_NOT_SUBMITTED: "Cette facture n'est pas validée.",

  INSUFFICIENT_STOCK: "Stock insuffisant dans l'entrepôt de départ : vous ne pouvez pas sortir plus que ce qu'il contient.",
  WAREHOUSE_NOT_EMPTY: "Cet entrepôt contient encore du stock : videz-le d'abord.",
  SE_NOT_DRAFT: "Seule une écriture en brouillon peut être validée.",
  MR_NOT_DRAFT: "Seule une demande en brouillon peut être modifiée.",

  ACCOUNT_CODE_TAKEN: "Ce code de compte existe déjà.",
  ACCOUNT_IS_GROUP: "Un compte de regroupement ne reçoit pas d'écriture : choisissez un compte détaillé.",
  ACCOUNT_FROZEN: "Ce compte est gelé.",
  ACCOUNT_HAS_POSTINGS: "Ce compte a déjà des écritures : il ne peut pas être supprimé.",
  JOURNAL_UNBALANCED: "Le total débit doit être égal au total crédit.",
  JOURNAL_LINE_BOTH_SIDES: "Une ligne ne peut pas être à la fois au débit et au crédit.",
  JOURNAL_LINE_EMPTY: "Chaque ligne doit avoir un montant.",
  JOURNAL_NOT_DRAFT: "Seule une écriture en brouillon peut être comptabilisée.",

  DOCUMENT_TYPE_INVALID: "Ce fichier n'est pas accepté : importez un PDF ou une photo (JPEG, PNG, HEIC).",
  DOCUMENT_TOO_LARGE: "Ce fichier dépasse 15 Mo : réduisez-le ou prenez une photo plutôt qu'un scan.",
  DOCUMENT_EMPTY: "Le fichier est vide.",
  DOCUMENT_NOT_FOUND: "Document introuvable.",
  DOCUMENT_PARENT_NOT_FOUND: "Le devis ou la facture de ce document est introuvable.",
  TOTAL_VAT_ABOVE_TOTAL: "La TVA ne peut pas dépasser le total TTC.",
  QUOTATION_NOT_FOUND: "Devis introuvable.",
  QUOTATION_NOT_DRAFT: "Seul un devis en brouillon peut être modifié.",
  QUOTATION_NOT_SUBMITTED: "Ce devis n'est pas validé.",
  QUOTATION_NO_LINES: "Ce devis n'a pas de lignes : saisissez-les pour en faire une commande.",
  INVOICE_NOT_FOUND: "Facture introuvable.",
  INVOICE_NOT_DRAFT: "Seule une facture en brouillon peut être modifiée.",
  INVOICE_NOT_SUBMITTED: "Cette facture n'est pas validée.",
  RFQ_NOT_FOUND: "Demande de devis introuvable.",
  RFQ_NOT_DRAFT: "Seule une demande en brouillon peut être modifiée.",
  ORDER_NOT_FOUND: "Commande introuvable.",
  ORDER_NOT_SETTLED: "Cette commande n'est pas encore encaissée.",
  EMAIL_NOT_CONFIGURED: "Aucun service d'envoi d'e-mails n'est configuré.",

  FOOD_INGREDIENT_NOT_FOUND: "Ingrédient introuvable.",
  FOOD_INGREDIENT_NAME_TAKEN: "Un article porte déjà ce nom : cherchez-le dans la liste plutôt que de le recréer.",
  BREAKDOWN_MISMATCH: "La répartition par catégorie ne correspond pas au total du document.",
  DIRECT_PURCHASE_ITEM_INVALID: "Un des ingrédients détaillés n'existe plus ou est une base maison : choisissez un ingrédient acheté.",
  RECEIPT_UNREADABLE: "Le ticket n'a pas pu être lu. Reprenez la photo bien à plat et éclairée, ou saisissez les montants à la main.",
  RECEIPT_PDF_SCANNED: "Ce PDF est une image scannée : envoyez plutôt une photo du ticket, ou saisissez les montants à la main.",
  FOOD_DISH_NOT_FOUND: "Plat introuvable.",
  FOOD_NO_CATALOGUE_MATCH: "Aucune fiche type ne correspond à ce plat : composez-la ingrédient par ingrédient.",
  FOOD_INVENTORY_NOT_FOUND: "Inventaire introuvable.",
  FOOD_INVENTORY_NOT_DRAFT: "Cet inventaire est déjà validé : il ne peut plus être modifié.",
  FOOD_PREPARATION_INVALID: "Une base se prépare avec des ingrédients bruts, pas avec une autre base.",
  FOOD_NO_COST: "Tous les ingrédients de cette base doivent avoir un prix avant de la produire.",
};

export const humanError = (code: string | undefined): string =>
  (code && MESSAGES[code]) ?? code ?? "Une erreur est survenue.";
