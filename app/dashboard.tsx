"use client";
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

export default function Dashboard() {
  const model = useDashboard();
  return (
    <main className="dashboard-shell">
      <DashboardSidebar
        rows={model.rows}
        menuOpen={model.menuOpen}
        setMenuOpen={model.setMenuOpen}
        setSourceOpen={model.setSourceOpen}

        openIntegrations={model.openIntegrations}
      />
      <section className="workspace" id="overview">
        <MobileHeader
          menuOpen={model.menuOpen}
          setMenuOpen={model.setMenuOpen}
          setSourceOpen={model.setSourceOpen}
        />
        <SectionTabs />
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
          rating={model.rating}
          tvAudience={model.tvAudience}
          download={model.download}
        />
        <TvZoneMap provinceRating={model.provinceRating} />
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
        <AffiliateSection />
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
      />
      <IntegrationsModal
        integrationsOpen={model.integrationsOpen}
        setIntegrationsOpen={model.setIntegrationsOpen}
        integrationLoading={model.integrationLoading}
        integrationStatus={model.integrationStatus}
        checkIntegrations={model.checkIntegrations}
      />
      <LoadingOverlay loading={model.loading} />
    </main>
  );
}
