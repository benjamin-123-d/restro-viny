"use server";

/**
 * The floating lamp asks for its own recommendations once it is on screen.
 *
 * They are not computed while the page renders on purpose: gathering them
 * reads sales, margin, purchases, stock and open tickets, and several screens
 * refresh themselves every ten seconds. Paying that price on every refresh, to
 * fill a panel nobody has opened yet, would slow down the whole dashboard.
 */

import { z } from "zod";

import { withManagerValidation } from "@/actions/helpers";
import type { Recommendation } from "@/lib/recommendations";
import { getRecommendations } from "@/services/recommendations.service";

export const getRecommendationsAction = withManagerValidation(
  z.object({}),
  (_data, ctx): Promise<Recommendation[]> => getRecommendations(ctx),
);
