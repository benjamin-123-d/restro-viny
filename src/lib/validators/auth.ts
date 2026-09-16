import { z } from "zod";

import { phoneSchema } from "@/lib/validators/shared";

export const requestOtpSchema = z.object({ phone: phoneSchema });
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Saisissez le code à 6 chiffres."),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const managerPinSchema = z
  .string()
  .trim()
  .regex(/^\d{4,6}$/, "Le code PIN fait 4 à 6 chiffres.");

export const setPinSchema = z.object({ pin: managerPinSchema });
export type SetPinInput = z.infer<typeof setPinSchema>;

export const verifyPinSchema = z.object({
  phone: phoneSchema,
  pin: managerPinSchema,
});
export type VerifyPinInput = z.infer<typeof verifyPinSchema>;
