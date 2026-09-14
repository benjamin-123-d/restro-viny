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
};

export const humanError = (code: string | undefined): string =>
  (code && MESSAGES[code]) ?? code ?? "Une erreur est survenue.";
