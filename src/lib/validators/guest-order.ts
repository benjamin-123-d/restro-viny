import { z } from "zod";

import { cartLineSchema } from "@/lib/validators/order";
import { idSchema, phoneSchema } from "@/lib/validators/shared";

/** A restaurant username as it appears in the `/order/[username]` URL. */
const usernameSchema = z.string().trim().min(1).max(40);

/** Six-digit SMS code, shared shape with the manager OTP flow. */
const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Saisissez le code à 6 chiffres.");

export const guestRequestOtpSchema = z.object({
  username: usernameSchema,
  tableId: idSchema,
  phone: phoneSchema,
});
export type GuestRequestOtpInput = z.infer<typeof guestRequestOtpSchema>;

export const guestVerifyOtpSchema = z.object({
  username: usernameSchema,
  tableId: idSchema,
  phone: phoneSchema,
  code: otpCodeSchema,
});
export type GuestVerifyOtpInput = z.infer<typeof guestVerifyOtpSchema>;

export const guestPlaceOrderSchema = z.object({
  username: usernameSchema,
  tableId: idSchema,
  idempotencyKey: z.string().trim().min(8).max(100),
  note: z.string().trim().max(300).optional(),
  items: z.array(cartLineSchema).min(1, "Ajoutez au moins un article."),
});
export type GuestPlaceOrderInput = z.infer<typeof guestPlaceOrderSchema>;
