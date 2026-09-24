"use client";
import RevenueReport from "@/components/dashboard/RevenueReport";
import AffiliateReport from "@/components/dashboard/AffiliateReport";
import type { User } from "@/lib/auth/types";

interface AffiliateSectionProps {
  currentUser?: User | null;
}

export function AffiliateSection({ currentUser }: AffiliateSectionProps) {
  return (
    <>
      <RevenueReport currentUser={currentUser} />
      <AffiliateReport currentUser={currentUser} />
    </>
  );
}

