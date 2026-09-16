"use client";

import { useEffect, useState } from "react";

import { getRecommendationsAction } from "@/actions/recommendations.actions";
import { RecommendationLamp } from "@/components/shared/recommendation-lamp";
import type { Recommendation } from "@/lib/recommendations";

/**
 * Fetches the recommendations once, after the dashboard has painted.
 *
 * The lamp sits in the layout, so it survives navigation from one screen to
 * the next and a `router.refresh()` does not make it fetch again — which is
 * the point: the figures behind it are worth reading once a visit, not every
 * ten seconds.
 */
export function RecommendationLampLoader() {
  const [recommendations, setRecommendations] = useState<readonly Recommendation[]>([]);

  useEffect(() => {
    let alive = true;
    void getRecommendationsAction({}).then((result) => {
      if (alive && result.success && result.data) setRecommendations(result.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Until they arrive the lamp is simply not there: an empty panel would be
  // worse than no lamp at all.
  if (recommendations.length === 0) return null;

  return <RecommendationLamp recommendations={recommendations} />;
}
