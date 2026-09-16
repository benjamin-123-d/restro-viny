import { z } from "zod";

/** E.164 phone number, e.g. +919876543210 — the primary identifier for a manager. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Indiquez le téléphone au format international, par exemple +33612345678.",
  );

/** Normalised (trimmed + lowercased) email address. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Indiquez une adresse e-mail valide."));

/** Non-empty identifier. */
export const idSchema = z.string().min(1, "Invalid id");

/** Human name, trimmed and length-bounded. */
export const nameSchema = z
  .string()
  .trim()
  .min(1, "Le nom est obligatoire.")
  .max(120, "Le nom fait 120 caractères au maximum.");
