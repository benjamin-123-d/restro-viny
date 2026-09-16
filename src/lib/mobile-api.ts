import type { NextRequest } from "next/server";
import type { z, ZodError, ZodType } from "zod";

import { apiError, apiOk, HttpError } from "@/lib/http-error";

import {
    MOBILE_MULTI_RESTAURANT_UNSUPPORTED,
    MOBILE_OTP_EXPIRED,
    MOBILE_OTP_INVALID,
    MOBILE_OTP_LOCKED,
    MOBILE_OTP_RATE_LIMITED,
    MOBILE_PIN_INVALID,
    MOBILE_PIN_LOCKED,
    MOBILE_PIN_NOT_SET,
    MOBILE_USER_NOT_FOUND,
} from "@/services/mobile-auth.service";
import {
    MOBILE_ORDER_DEDUPE,
    MOBILE_ORDER_FORBIDDEN_ROLE,
    MOBILE_ORDER_INVALID_TRANSITION,
    MOBILE_ORDER_NO_RESTAURANT,
    MOBILE_ORDER_NOT_ALLOWED,
    MOBILE_ORDER_NOT_FOUND,
} from "@/services/mobile-orders.service";

const fieldErrorsFromZod = (error: ZodError): Record<string, string[]> => {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
};

// Single source of truth for domain → HTTP mapping. Adding a new mobile service
// error is one entry here, not one switch per route.
const errorMap: Record<
  string,
  { status: number; code: string; message: string }
> = {
  [MOBILE_USER_NOT_FOUND]: {
    status: 404,
    code: "USER_NOT_FOUND",
    message: "Aucun compte n'est enregistré sur ce numéro.",
  },
  [MOBILE_MULTI_RESTAURANT_UNSUPPORTED]: {
    status: 409,
    code: "MULTI_RESTAURANT_UNSUPPORTED",
    message:
      "Ce téléphone est rattaché à plusieurs restaurants. Contactez votre responsable.",
  },
  [MOBILE_OTP_RATE_LIMITED]: {
    status: 429,
    code: "RATE_LIMITED",
    message: "Patientez un instant avant de demander un nouveau code.",
  },
  [MOBILE_OTP_EXPIRED]: {
    status: 410,
    code: "OTP_EXPIRED",
    message: "Ce code a expiré. Demandez-en un nouveau.",
  },
  [MOBILE_OTP_INVALID]: {
    status: 400,
    code: "INVALID_CODE",
    message: "Code incorrect. Réessayez.",
  },
  [MOBILE_OTP_LOCKED]: {
    status: 429,
    code: "OTP_LOCKED",
    message: "Trop de tentatives. Réessayez plus tard.",
  },
  [MOBILE_PIN_INVALID]: {
    status: 400,
    code: "INVALID_PIN",
    message: "Code PIN incorrect. Réessayez.",
  },
  [MOBILE_PIN_LOCKED]: {
    status: 423,
    code: "PIN_LOCKED",
    message: "Code PIN bloqué. Connectez-vous avec un code reçu par SMS, ou demandez à votre responsable.",
  },
  [MOBILE_PIN_NOT_SET]: {
    status: 403,
    code: "PIN_NOT_SET",
    message: "Ce compte n'a pas encore de code PIN. Connectez-vous avec un code reçu par SMS.",
  },
  [MOBILE_ORDER_NOT_FOUND]: {
    status: 404,
    code: "ORDER_NOT_FOUND",
    message: "Cette commande n'existe pas.",
  },
  [MOBILE_ORDER_NOT_ALLOWED]: {
    status: 403,
    code: "NOT_ALLOWED",
    message: "Vous n'avez pas accès à cette commande.",
  },
  [MOBILE_ORDER_INVALID_TRANSITION]: {
    status: 409,
    code: "INVALID_TRANSITION",
    message: "Cette commande n'est pas dans un état qui permet cette action.",
  },
  [MOBILE_ORDER_NO_RESTAURANT]: {
    status: 403,
    code: "NO_RESTAURANT",
    message: "Aucun restaurant n'est associé à votre compte.",
  },
  [MOBILE_ORDER_DEDUPE]: {
    status: 200,
    code: "DEDUPE_COLLISION",
    message: "Cette demande a déjà été prise en compte.",
  },
  [MOBILE_ORDER_FORBIDDEN_ROLE]: {
    status: 403,
    code: "FORBIDDEN_ROLE",
    message: "Votre rôle ne permet pas cette action. Demandez à un responsable.",
  },
};

export const toMobileHttpError = (err: unknown): HttpError => {
  if (err instanceof HttpError) return err;
  if (err instanceof Error) {
    const entry = errorMap[err.message];
    if (entry) {
      return new HttpError(entry.status, entry.code, entry.message);
    }
  }
  return new HttpError(500, "INTERNAL", "Une erreur est survenue.");
};
const toHttpError = toMobileHttpError;

/**
 * Wrap a mobile POST endpoint: parse JSON body, validate with Zod, call the
 * handler, and translate service errors to HTTP. Keeps route files declarative.
 */
export const withMobileJsonRoute = <TSchema extends ZodType, TResult>(
  schema: TSchema,
  handler: (data: z.infer<TSchema>) => Promise<TResult>,
) => {
  return async (req: NextRequest): Promise<Response> => {
    try {
      const body: unknown = await req.json().catch(() => ({}));
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return apiError(
          new HttpError(
            400,
            "INVALID_INPUT",
            "Validation failed",
            fieldErrorsFromZod(parsed.error),
          ),
        );
      }
      const result = await handler(parsed.data);
      return apiOk(result);
    } catch (err) {
      return apiError(toHttpError(err));
    }
  };
};
