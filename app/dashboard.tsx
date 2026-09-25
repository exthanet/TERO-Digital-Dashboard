"use client";
import { useState } from "react";
import { AffiliateSection } from "@/components/dashboard/sections/AffiliateSection";
import { CompareTable } from "@/components/dashboard/sections/CompareTable";
import { DashboardFilters } from "@/components/dashboard/sections/DashboardFilters";
import { DashboardFooter } from "@/components/dashboard/sections/DashboardFooter";
import { DashboardSidebar } from "@/components/dashboard/sections/DashboardSidebar";
import { DataSourceModal } from "@/components/dashboard/sections/DataSourceModal";
import { DataStatus } from "@/components/dashboard/sections/DataStatus";
import { ExecutiveAnalysis } from "@/components/dashboard/sections/ExecutiveAnalysis";
import { ExecutiveCharts } from "@/components/dashboard/sections/ExecutiveCharts";
import { ExecutiveInsights } from "@/components/dashboard/sections/ExecutiveInsights";
import { IntegrationsModal } from "@/components/dashboard/sections/IntegrationsModal";
import { KpiSummary } from "@/components/dashboard/sections/KpiSummary";
import { LoadingOverlay } from "@/components/dashboard/sections/LoadingOverlay";
import { MobileHeader } from "@/components/dashboard/sections/MobileHeader";
import { PerformanceSections } from "@/components/dashboard/sections/PerformanceSections";
import { SectionTabs } from "@/components/dashboard/sections/SectionTabs";
import { TvZoneMap } from "@/components/dashboard/sections/TvZoneMap";
import { useDashboard } from "@/hooks/useDashboard";
import { useAuth } from "@/hooks/useAuth";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { UserManagementModal } from "@/components/auth/UserManagementModal";
import { SignUpModal } from "@/components/auth/SignUpModal";
import "@/styles/auth.css";

import RevenueReport from "@/components/dashboard/RevenueReport";
import AffiliateReport from "@/components/dashboard/AffiliateReport";

export default function Dashboard() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "revenue" | "affiliate">("overview");
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const model = useDashboard();

  if (auth.isLoading) {
    return <LoadingOverlay loading={true} />;
  }

  if (!auth.isAuthenticated) {
    return <AuthScreen auth={auth} />;
  }

  return (
    <main className="dashboard-shell">
      <DashboardSidebar
        rows={model.rows}
        menuOpen={model.menuOpen}
        setMenuOpen={model.setMenuOpen}
        setSourceOpen={model.setSourceOpen}
        openIntegrations={model.openIntegrations}
        currentUser={auth.user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <section className="workspace" id="overview">
        <MobileHeader
          menuOpen={model.menuOpen}
          setMenuOpen={model.setMenuOpen}
          setSourceOpen={model.setSourceOpen}
        />
        <SectionTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentUser={auth.user}
          onOpenSignUp={() => setSignUpOpen(true)}
          onOpenChangePassword={() => setChangePasswordOpen(true)}
          onOpenUserManagement={() => setUserManagementOpen(true)}
          onLogout={auth.logout}
        />

        {activeTab === "overview" && (
          <>
            <DashboardFilters
              setSourceOpen={model.setSourceOpen}
              program={model.program}
              setProgram={model.setProgram}
              platform={model.platform}
              setPlatform={model.setPlatform}
              vdoType={model.vdoType}
              setVdoType={model.setVdoType}
              topicType={model.topicType}
              setTopicType={model.setTopicType}
              search={model.search}
              setSearch={model.setSearch}
              startDate={model.startDate}
              setStartDate={model.setStartDate}
              endDate={model.endDate}
              setEndDate={model.setEndDate}
              datePreset={model.datePreset}
              setDatePreset={model.setDatePreset}
              options={model.options}
              applyDatePreset={model.applyDatePreset}
            />
            <DataStatus
              sourceName={model.sourceName}
              uploadedAt={model.uploadedAt}
              message={model.message}
              filtered={model.filtered}
              reset={model.reset}
              currentUser={auth.user}
              cloudSaving={model.cloudSaving}
              onSaveToCloud={async () => {
                await model.saveCurrentDataToCloud(auth.user?.role);
              }}
            />
            <KpiSummary
              tvMode={model.tvMode}
              performanceFiltered={model.performanceFiltered}
              metrics={model.metrics}
              types={model.types}
            />
            <ExecutiveInsights insights={model.insights} />
            <ExecutiveCharts
              executiveChartType={model.executiveChartType}
              setExecutiveChartType={model.setExecutiveChartType}
              executiveGrain={model.executiveGrain}
              digitalVsTv={model.digitalVsTv}
              programPie={model.programPie}
              platformPie={model.platformPie}
              vdoTypePie={model.vdoTypePie}
            />
            <ExecutiveAnalysis
              tvMode={model.tvMode}
              performanceValue={model.performanceValue}
              top={model.top}
              platformAnalysis={model.platformAnalysis}
              topicTrend={model.topicTrend}
              q4Plan={model.q4Plan}
            />
            <PerformanceSections
              vdoType={model.vdoType}
              topVdoType={model.topVdoType}
              setTopVdoType={model.setTopVdoType}
              grain={model.grain}
              setGrain={model.setGrain}
              options={model.options}
              digitalFiltered={model.digitalFiltered}
              tvMode={model.tvMode}
              performanceValue={model.performanceValue}
              metrics={model.metrics}
              chartGrain={model.chartGrain}
              daily={model.daily}
              types={model.types}
              topics={model.topics}
              platforms={model.platforms}
              programs={model.programs}
              top={model.top}
              best={model.best}
              provinceRating={model.provinceRating}
              rating={model.rating}
              ratingGrain={model.ratingGrain}
              setRatingGrain={model.setRatingGrain}
              tvRatingBreakdown={model.tvRatingBreakdown}
              tvAudience={model.tvAudience}
              download={model.download}
            />
            <CompareTable
              comparePage={model.comparePage}
              setComparePage={model.setComparePage}
              comparePageSize={model.comparePageSize}
              setComparePageSize={model.setComparePageSize}
              compareSort={model.compareSort}
              compareDirection={model.compareDirection}
              compareSorted={model.compareSorted}
              comparePageCount={model.comparePageCount}
              compareRows={model.compareRows}
              sortCompare={model.sortCompare}
              download={model.download}
            />
          </>
        )}

        {activeTab === "revenue" && (
          <div style={{ marginTop: 8 }}>
            <RevenueReport currentUser={auth.user} />
          </div>
        )}

        {activeTab === "affiliate" && (
          <div style={{ marginTop: 8 }}>
            <AffiliateReport currentUser={auth.user} />
          </div>
        )}

        <DashboardFooter />
      </section>
      <DataSourceModal
        loading={model.loading}
        sourceOpen={model.sourceOpen}
        setSourceOpen={model.setSourceOpen}
        sheetUrl={model.sheetUrl}
        setSheetUrl={model.setSheetUrl}
        fileRef={model.fileRef}
        loadSheet={model.loadSheet}
        onFile={model.onFile}
        sourceName={model.sourceName}
        rowsCount={model.rows.length}
        cloudSaving={model.cloudSaving}
        cloudSaveProgress={model.cloudSaveProgress}
        onSaveToCloud={async () => {
          await model.saveCurrentDataToCloud(auth.user?.role);
        }}
        currentUser={auth.user}
      />
      <IntegrationsModal
        integrationsOpen={model.integrationsOpen}
        setIntegrationsOpen={model.setIntegrationsOpen}
        integrationLoading={model.integrationLoading}
        integrationStatus={model.integrationStatus}
        checkIntegrations={model.checkIntegrations}
      />
      <SignUpModal
        isOpen={signUpOpen}
        onClose={() => setSignUpOpen(false)}
        auth={auth}
      />
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        auth={auth}
      />
      <UserManagementModal
        isOpen={userManagementOpen}
        onClose={() => setUserManagementOpen(false)}
        auth={auth}
      />
      <LoadingOverlay loading={model.loading} />
    </main>
  );
}
