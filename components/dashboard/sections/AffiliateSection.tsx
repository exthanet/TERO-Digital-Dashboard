"use client";
import AffiliateReport from "@/components/dashboard/AffiliateReport";
import type { User } from "@/lib/auth/types";

interface AffiliateSectionProps {
  currentUser?: User | null;
}

export function AffiliateSection({ currentUser }: AffiliateSectionProps) {
  return (
    <>
      <AffiliateReport currentUser={currentUser} />
    </>
  );
}
