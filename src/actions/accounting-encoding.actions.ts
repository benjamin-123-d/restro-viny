"use server";

/**
 * The accountant's own actions. All gated on the ACCOUNTING module, so an
 * external accountant can be given a role that opens this and nothing else.
 */

import { withPermission } from "@/actions/helpers";
import {
  pieceIdSchema,
  savePieceSchema,
  upsertAccountSchema,
} from "@/lib/validators/accounting-encoding";
import {
  postPiece,
  reversePiece,
  savePiece,
  syncInbox,
  upsertAccountByCode,
} from "@/services/accounting-encoding.service";
import { z } from "zod";

export const savePieceAction = withPermission("ACCOUNTING", "EDIT", savePieceSchema, (data, ctx) =>
  savePiece(ctx, data),
);

export const postPieceAction = withPermission("ACCOUNTING", "EDIT", pieceIdSchema, (data, ctx) =>
  postPiece(ctx, data.id),
);

export const reversePieceAction = withPermission("ACCOUNTING", "EDIT", pieceIdSchema, (data, ctx) =>
  reversePiece(ctx, data.id),
);

export const upsertAccountAction = withPermission("ACCOUNTING", "EDIT", upsertAccountSchema, (data, ctx) =>
  upsertAccountByCode(ctx, data.code, data.name),
);

export const syncInboxAction = withPermission("ACCOUNTING", "EDIT", z.object({}), (_data, ctx) =>
  syncInbox(ctx),
);
