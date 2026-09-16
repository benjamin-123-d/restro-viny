import { z } from "zod";

import { idSchema, phoneSchema } from "@/lib/validators/shared";

const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Saisissez le code à 6 chiffres.");

const mobilePinSchema = z
  .string()
  .trim()
  .regex(/^\d{4,6}$/, "Le code PIN fait 4 à 6 chiffres.");

export const mobileRequestOtpSchema = z.object({ phone: phoneSchema });
export type MobileRequestOtpInput = z.infer<typeof mobileRequestOtpSchema>;

export const mobileVerifyOtpSchema = z.object({
  phone: phoneSchema,
  challengeId: idSchema,
  code: codeSchema,
});
export type MobileVerifyOtpInput = z.infer<typeof mobileVerifyOtpSchema>;

export const mobileVerifyPinSchema = z.object({
  phone: phoneSchema,
  pin: mobilePinSchema,
});
export type MobileVerifyPinInput = z.infer<typeof mobileVerifyPinSchema>;
