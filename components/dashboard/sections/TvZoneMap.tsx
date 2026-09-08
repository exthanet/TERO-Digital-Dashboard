"use client";
import TvRatingChoropleth from "@/components/dashboard/TvRatingChoropleth";
import type { DashboardModel } from "@/hooks/useDashboard";
export function TvZoneMap({
  provinceRating,
}: Pick<DashboardModel, "provinceRating">) {
  return (
    <>
      <TvRatingChoropleth data={provinceRating} />
    </>
  );
}
