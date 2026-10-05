"use client";
import { useEffect, useState } from "react";
import { AffiliateSection } from "@/components/dashboard/sections/AffiliateSection";
import { CompareTable } from "@/components/dashboard/sections/CompareTable";
import { DashboardFilters } from "@/components/dashboard/sections/DashboardFilters";
import { DashboardFooter } from "@/components/dashboard/sections/DashboardFooter";
import { DashboardSidebar } from "@/components/dashboard/sections/DashboardSidebar";
import { DataSourceModal } from "@/components/dashboard/sections/DataSourceModal";
import { DataStatus } from "@/components/dashboard/sections/DataStatus";
import { GrowthSection } from "@/components/dashboard/sections/GrowthSection";
import { QualitySection } from "@/components/dashboard/sections/QualitySection";
import { ThumbnailSection } from "@/components/dashboard/sections/ThumbnailSection";
import { AdviceSection } from "@/components/dashboard/sections/AdviceSection";
import { HelpSection } from "@/components/dashboard/sections/HelpSection";
import { AudienceReport } from "@/components/dashboard/sections/AudienceReport";
import { TvCompetitorChart } from "@/components/dashboard/sections/TvCompetitorChart";
import { ExecutiveAnalysis } from "@/components/dashboard/sections/ExecutiveAnalysis";
import { ExecutiveCharts } from "@/components/dashboard/sections/ExecutiveCharts";
import { ExecutiveInsights } from "@/components/dashboard/sections/ExecutiveInsights";
import { KpiSummary } from "@/components/dashboard/sections/KpiSummary";
import { TopLoadingBar } from "@/components/dashboard/sections/TopLoadingBar";
import { MobileHeader } from "@/components/dashboard/sections/MobileHeader";
import { PerformanceSections } from "@/components/dashboard/sections/PerformanceSections";
import { RankingSection } from "@/components/dashboard/sections/RankingSection";
import { YouTubeDeepDiveSection } from "@/components/dashboard/sections/YouTubeDeepDiveSection";
import { SectionTabs } from "@/components/dashboard/sections/SectionTabs";
import { SyncStatusModal } from "@/components/dashboard/sections/SyncStatusModal";
import { TvSourcesModal } from "@/components/dashboard/sections/TvSourcesModal";
import { TvUploadModal } from "@/components/dashboard/sections/TvUploadModal";
import { NotificationsModal } from "@/components/dashboard/sections/NotificationsModal";
import { TvZoneMap } from "@/components/dashboard/sections/TvZoneMap";
import { useDashboard } from "@/hooks/useDashboard";
import { useAuth } from "@/hooks/useAuth";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { PasswordActionScreen, readPasswordAction } from "@/components/auth/PasswordActionScreen";
import { FirstPasswordScreen } from "@/components/auth/FirstPasswordScreen";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { UserManagementModal } from "@/components/auth/UserManagementModal";
import { loadSyncStatus, type SyncStatus } from "@/lib/sync/status";
import "@/styles/auth.css";

import RevenueReport from "@/components/dashboard/RevenueReport";
import AffiliateReport from "@/components/dashboard/AffiliateReport";
import { track } from "@/lib/loadingBar";

// Same breakpoint as the mobile rules in styles/dashboard.css.
const MOBILE_QUERY = "(max-width: 800px)";

export default function Dashboard() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "revenue" | "affiliate" | "growth" | "quality" | "thumbnail" | "youtube" | "advice" | "help">("overview");
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  // Set-password link from an invitation / "ลืมรหัสผ่าน" email (?mode=resetPassword&oobCode=…).
  const [passwordAction, setPasswordAction] = useState(() =>
    typeof window === "undefined" ? null : readPasswordAction(window.location.search),
  );
  const [passwordSetFor, setPasswordSetFor] = useState<string | null>(null);
  const [tvSourcesOpen, setTvSourcesOpen] = useState(false);
  const [tvUploadOpen, setTvUploadOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  // undefined = not loaded; null = no sync has run yet.
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null | undefined>(undefined);
  // Firestore only serves data to signed-in, active accounts.
  // No data until the person has replaced a temporary password.
  const model = useDashboard(auth.isAuthenticated && !auth.user?.mustChangePassword);
  const { setPlatform, setVdoType, setTopicType, setSearch, setMenuOpen } = model;

  // Phones only show the รายการ and วันเดือนปี filters, so the hidden ones
  // are cleared to keep the numbers matching what the screen says.
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const apply = () => {
      if (mql.matches) {
        setPlatform("ALL");
        setVdoType("ALL");
        setTopicType("ALL");
        setSearch("");
      } else {
        setMenuOpen(false);
      }
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [setPlatform, setVdoType, setTopicType, setSearch, setMenuOpen]);

  const isAdmin = auth.user?.role === "admin";

  // "?" links beside section headings point at #help-{topic}: open the help
  // page and scroll to that topic once it is on screen.
  useEffect(() => {
    const open = () => {
      const id = window.location.hash.slice(1);
      if (!id.startsWith("help")) return;
      setActiveTab("help");
      // Jump (not animate): the page may still be drawing the help page, and the
      // site-wide smooth scrolling does not run in a background tab.
      let tries = 0;
      const jump = () => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
        else if (tries++ < 20) window.setTimeout(jump, 50);
      };
      window.setTimeout(jump, 0);
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  // Admins get the latest sync result (one read) for the warning banner.
  useEffect(() => {
    if (!isAdmin) return;
    track(loadSyncStatus())
      .then(setSyncStatus)
      .catch(() => setSyncStatus(undefined));
  }, [isAdmin]);

  if (passwordAction) {
    return (
      <PasswordActionScreen
        action={passwordAction}
        onDone={(email) => {
          // The one-time code must not stay in the address bar or history.
          window.history.replaceState(null, "", window.location.pathname);
          if (auth.isAuthenticated) void auth.logout();
          setPasswordSetFor(email);
          setPasswordAction(null);
        }}
      />
    );
  }

  if (auth.isLoading) {
    return <TopLoadingBar busy />;
  }

  if (!auth.isAuthenticated) {
    return (
      <AuthScreen
        auth={auth}
        initialEmail={passwordSetFor || ""}
        initialInfo={passwordSetFor ? "ตั้งรหัสผ่านเรียบร้อยแล้ว เข้าสู่ระบบได้เลย" : undefined}
      />
    );
  }

  if (auth.user?.mustChangePassword) {
    return <FirstPasswordScreen auth={auth} />;
  }

  return (
    <main className="dashboard-shell">
      <DashboardSidebar
        menuOpen={model.menuOpen}
        setMenuOpen={model.setMenuOpen}
        setSourceOpen={model.setSourceOpen}
        openSyncStatus={() => {
          setSyncOpen(true);
          model.setMenuOpen(false);
        }}
        currentUser={auth.user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        syncStatus={syncStatus}
        openTvSources={() => setTvSourcesOpen(true)}
        openTvUpload={() => setTvUploadOpen(true)}
        openNotifications={() => setNotificationsOpen(true)}
        onOpenUserManagement={() => setUserManagementOpen(true)}
        onOpenChangePassword={() => setChangePasswordOpen(true)}
        onLogout={auth.logout}
      />
      <section className="workspace" id="overview">
        <MobileHeader
          menuOpen={model.menuOpen}
          setMenuOpen={model.setMenuOpen}
        />
        <SectionTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {(activeTab === "overview" || ((activeTab === "growth" || activeTab === "quality" || activeTab === "thumbnail" || activeTab === "youtube" || activeTab === "advice") && isAdmin)) && (
            <DashboardFilters
              program={model.filterInputs.program}
              setProgram={model.setProgram}
              platform={model.filterInputs.platform}
              setPlatform={model.setPlatform}
              vdoType={model.filterInputs.vdoType}
              setVdoType={model.setVdoType}
              topicType={model.filterInputs.topicType}
              setTopicType={model.setTopicType}
              search={model.filterInputs.search}
              setSearch={model.setSearch}
              startDate={model.filterInputs.startDate}
              setStartDate={model.setStartDate}
              endDate={model.filterInputs.endDate}
              setEndDate={model.setEndDate}
              datePreset={model.filterInputs.datePreset}
              setDatePreset={model.setDatePreset}
              options={model.options}
              applyDatePreset={model.applyDatePreset}
              dataFirstDate={model.dataFirstDate}
            />
        )}

        {activeTab === "growth" && isAdmin && (
          <GrowthSection
            rows={model.growthRows}
            allRows={model.rows}
            startDate={model.startDate}
            endDate={model.endDate}
            comparePeriod={model.comparePeriod}
          />
        )}

        {activeTab === "help" && <HelpSection isAdmin={isAdmin} />}

        {activeTab === "advice" && isAdmin && (
          <AdviceSection
            rows={model.filtered}
            allRows={model.rankingRows}
            startDate={model.startDate}
            endDate={model.endDate}
            latestDate={model.dataLatestDate}
            comparePeriod={model.comparePeriod}
          />
        )}

        {activeTab === "youtube" && isAdmin && (
          <YouTubeDeepDiveSection rows={model.filtered} allRows={model.rows} latestDate={model.dataLatestDate} />
        )}

        {activeTab === "thumbnail" && isAdmin && (
          <ThumbnailSection
            rows={model.filtered}
            startDate={model.startDate}
            endDate={model.endDate}
            latestDate={model.dataLatestDate}
          />
        )}

        {activeTab === "quality" && isAdmin && (
          <QualitySection
            rows={model.filtered}
            allRows={model.rankingRows}
            startDate={model.startDate}
            endDate={model.endDate}
            comparePeriod={model.comparePeriod}
          />
        )}

        {activeTab === "overview" && (
          <>
            <DataStatus
              sourceName={model.sourceName}
              message={model.message}
              filtered={model.filtered}
              reset={model.reset}
              currentUser={auth.user}
              cloudSaving={model.cloudSaving}
              onSaveToCloud={async () => {
                await model.saveCurrentDataToCloud(auth.user?.role);
              }}
              syncStatus={syncStatus}
              onOpenSync={() => setSyncOpen(true)}
            />
            <KpiSummary
              tvMode={model.tvMode}
              performanceFiltered={model.performanceFiltered}
              metrics={model.metrics}
              types={model.types}
              growth={model.growth}
              comparePeriod={model.comparePeriod}
              compareMode={model.filterInputs.compareMode}
              setCompareMode={model.setCompareMode}
              compareStart={model.filterInputs.compareStart}
              setCompareStart={model.setCompareStart}
              compareEnd={model.filterInputs.compareEnd}
              setCompareEnd={model.setCompareEnd}
              dataFirstDate={model.dataFirstDate}
            />
            <ExecutiveInsights insights={model.insights} />
            <RankingSection
              rows={model.rows}
              rankingRows={model.rankingRows}
              dataLatestDate={model.dataLatestDate}
              startDate={model.startDate}
              endDate={model.endDate}
            />
            <ExecutiveCharts
              executiveChartType={model.executiveChartType}
              setExecutiveChartType={model.setExecutiveChartType}
              executiveGrain={model.executiveGrain}
              digitalVsTv={model.digitalVsTv}
              digitalPlatforms={model.digitalPlatforms}
              vdoTypeTrend={model.vdoTypeTrend}
              accountPie={model.accountPie}
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
              topTopicType={model.topTopicType}
              setTopTopicType={model.setTopTopicType}
              topicType={model.topicType}
              options={model.options}
              tvMode={model.tvMode}
              performanceValue={model.performanceValue}
              metrics={model.metrics}
              topics={model.topics}
              top={model.top}
              provinceRating={model.provinceRating}
              rating={model.rating}
              ratingGrain={model.ratingGrain}
              setRatingGrain={model.setRatingGrain}
              tvRatingBreakdown={model.tvRatingBreakdown}
              tvAudience={model.tvAudience}
              download={model.download}
              tvCompetitors={
                <TvCompetitorChart
                  rows={model.rankingRows}
                  program={model.program}
                  startDate={model.startDate}
                  endDate={model.endDate}
                  grain={model.executiveGrain}
                />
              }
              audienceReport={
                <AudienceReport
                  rows={model.filtered}
                  prevRows={
                    model.comparePeriod
                      ? model.rankingRows.filter((r) => r.date >= model.comparePeriod!.start && r.date <= model.comparePeriod!.end)
                      : []
                  }
                  grain={model.executiveGrain}
                  compareText={model.comparePeriod ? `เทียบกับ ${model.comparePeriod.start} – ${model.comparePeriod.end}` : ""}
                />
              }
            />
            <CompareTable
              comparePage={model.comparePage}
              setComparePage={model.setComparePage}
              comparePageSize={model.comparePageSize}
              setComparePageSize={model.setComparePageSize}
              compareSort={model.compareSort}
              compareDirection={model.compareDirection}
              compareSorted={model.compareSorted}
              compareTotals={model.compareTotals}
              compareFilter={model.compareFilter}
              setCompareFilter={model.setCompareFilter}
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

        <DashboardFooter sourceName={model.sourceName} uploadedAt={model.uploadedAt} totalRows={model.rows.length} />
      </section>
      <DataSourceModal
        loading={model.loading}
        sourceOpen={model.sourceOpen && isAdmin}
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
      <SyncStatusModal open={syncOpen && isAdmin} onClose={() => setSyncOpen(false)} status={syncStatus ?? null} />
      <TvSourcesModal
        open={tvSourcesOpen && isAdmin}
        onClose={() => setTvSourcesOpen(false)}
        status={syncStatus ?? null}
        userEmail={auth.user?.email || ""}
      />
      <TvUploadModal
        open={tvUploadOpen && isAdmin}
        onClose={() => setTvUploadOpen(false)}
        rawRows={model.rawRows}
        userEmail={auth.user?.email || ""}
      />
      <NotificationsModal
        open={notificationsOpen && isAdmin}
        onClose={() => setNotificationsOpen(false)}
        status={syncStatus ?? null}
        userEmail={auth.user?.email || ""}
      />
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        auth={auth}
      />
      <UserManagementModal
        isOpen={userManagementOpen && auth.user?.role === "admin"}
        onClose={() => setUserManagementOpen(false)}
        auth={auth}
      />
      <TopLoadingBar busy={model.loading || model.filtering} />
    </main>
  );
}
