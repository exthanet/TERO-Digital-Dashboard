"use client";
import { dashboardAsset, isStaticHost } from "@/lib/dashboard/hosting";
import {
  loadMasterDataFromFirebase,
  loadMasterDataWithMetaFromFirebase,
  saveMasterDataToFirebase,
} from "@/lib/firebase";
import { bestFormat, sumBy, topicSimilarity } from "@/lib/dashboard/analytics";
import { PROGRAMS } from "@/lib/dashboard/constants";
import { parseCsv } from "@/lib/dashboard/csv";
import { getDatePresetRange, isoDate } from "@/lib/dashboard/dates";
import { compact, num, pct } from "@/lib/dashboard/format";
import { n, normalize, normalizeRowsWithDeduplication } from "@/lib/dashboard/normalize";
import type {
  CompareRow,
  CompareSortKey,
  DatePreset,
  IntegrationMap,
  RawRow,
  RecordRow,
} from "@/lib/dashboard/types";
import { useEffect, useMemo, useRef, useState } from "react";
export function useDashboard() {
  const [rows, setRows] = useState<RecordRow[]>([]),
    [rawRows, setRawRows] = useState<RawRow[]>([]),
    [cloudSaving, setCloudSaving] = useState(false),
    [cloudSaveProgress, setCloudSaveProgress] = useState<{
      current: number;
      total: number;
    } | null>(null),
    [loading, setLoading] = useState(true),
    [menuOpen, setMenuOpen] = useState(false),
    [sourceOpen, setSourceOpen] = useState(false),
    [integrationsOpen, setIntegrationsOpen] = useState(false),
    [integrationLoading, setIntegrationLoading] = useState(false),
    [integrationStatus, setIntegrationStatus] = useState<IntegrationMap | null>(
      null,
    ),
    [sheetUrl, setSheetUrl] = useState(""),
    [sourceName, setSourceName] = useState("Firebase Firestore"),
    [uploadedAt, setUploadedAt] = useState(""),
    [message, setMessage] = useState("");
  const [program, setProgram] = useState("ALL"),
    [platform, setPlatform] = useState("ALL"),
    [vdoType, setVdoType] = useState("ALL"),
    [topicType, setTopicType] = useState("ALL"),
    [search, setSearch] = useState(""),
    [startDate, setStartDate] = useState(""),
    [endDate, setEndDate] = useState(""),
    [datePreset, setDatePreset] = useState<DatePreset>("ALL");
  const [topVdoType, setTopVdoType] = useState("ALL");
  const [grain, setGrain] = useState<"day" | "month" | "year">("day");
  const [ratingGrain, setRatingGrain] = useState<"day" | "month" | "year">("day");
  const fileRef = useRef<HTMLInputElement>(null);
  const [executiveChartType, setExecutiveChartType] = useState<"line" | "bar">(
    "line",
  );
  const [comparePage, setComparePage] = useState(1),
    [comparePageSize, setComparePageSize] = useState(20),
    [compareSort, setCompareSort] = useState<CompareSortKey>("date"),
    [compareDirection, setCompareDirection] = useState<"asc" | "desc">("desc");
  useEffect(() => {
    async function initDashboardData() {
      try {
        if (!isStaticHost) {
          const cloudResult = await loadMasterDataWithMetaFromFirebase().catch(() => null);
          if (cloudResult && cloudResult.rows.length > 0) {
            setRawRows(cloudResult.rows);
            const x = normalizeRowsWithDeduplication(cloudResult.rows);
            setRows(x);
            const d = x.map((r) => r.date).sort();
            setStartDate(d[0] || "");
            setEndDate(d.at(-1) || "");
            setSourceName("Firebase Firestore");
            if (cloudResult.updatedAt) {
              setUploadedAt(cloudResult.updatedAt);
            }
            setLoading(false);
            return;
          }
        }

        // Fallback or static host: fetch master-data.json with last-modified header
        const res = await fetch(dashboardAsset("master-data.json"));
        const lastModifiedHeader = res.headers.get("last-modified");
        const data: RawRow[] = await res.json();
        setRawRows(data);
        const x = normalizeRowsWithDeduplication(data);
        setRows(x);
        const d = x.map((r) => r.date).sort();
        setStartDate(d[0] || "");
        setEndDate(d.at(-1) || "");
        setSourceName(isStaticHost ? "master-data.json" : "Firebase Firestore");
        if (lastModifiedHeader) {
          setUploadedAt(new Date(lastModifiedHeader).toISOString());
        }
        setLoading(false);
      } catch {
        setMessage("โหลดข้อมูลเริ่มต้นไม่สำเร็จ");
        setLoading(false);
      }
    }

    initDashboardData();
  }, []);
  const options = useMemo(
    () => ({
      programs: [...new Set([...PROGRAMS, ...rows.map((r) => r.program)])]
        .filter(Boolean)
        .sort(),
      platforms: [...new Set(rows.map((r) => r.platform))]
        .filter(Boolean)
        .sort(),
      vdoTypes: [...new Set(rows.map((r) => r.vdoType))].filter(Boolean).sort(),
      topicTypes: [...new Set(rows.map((r) => r.topicType))]
        .filter(Boolean)
        .sort(),
    }),
    [rows],
  );
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (program === "ALL" || r.program === program) &&
          (platform === "ALL" || r.platform === platform) &&
          (vdoType === "ALL" || r.vdoType === vdoType) &&
          (topicType === "ALL" || r.topicType === topicType) &&
          (!startDate || r.date >= startDate) &&
          (!endDate || r.date <= endDate) &&
          (!search ||
            `${r.topic} ${r.program} ${r.channel}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [rows, program, platform, vdoType, topicType, startDate, endDate, search],
  );
  const executiveRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (program === "ALL" || r.program === program) &&
          (vdoType === "ALL" || r.vdoType === vdoType) &&
          (topicType === "ALL" || r.topicType === topicType) &&
          (!startDate || r.date >= startDate) &&
          (!endDate || r.date <= endDate) &&
          (!search ||
            `${r.topic} ${r.program} ${r.channel}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [rows, program, vdoType, topicType, startDate, endDate, search],
  );
  const executiveGrain = useMemo<"day" | "month">(
    () =>
      startDate && endDate && startDate.slice(0, 7) === endDate.slice(0, 7)
        ? "day"
        : "month",
    [startDate, endDate],
  );
  const digitalVsTv = useMemo(() => {
    const m = new Map<
      string,
      { date: string; "Digital Views": number; "TV Audience": number }
    >();
    executiveRows.forEach((r) => {
      const key = executiveGrain === "day" ? r.date : r.date.slice(0, 7),
        x = m.get(key) || { date: key, "Digital Views": 0, "TV Audience": 0 };
      if (r.platform === "TV")
        x["TV Audience"] += r.audienceTotal + r.gmmAudience;
      else x["Digital Views"] += r.views;
      m.set(key, x);
    });
    return [...m.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(executiveGrain === "day" ? -31 : -24);
  }, [executiveRows, executiveGrain]);
  const programPie = useMemo(
    () =>
      sumBy(
        executiveRows,
        (r) => r.program,
        (r) =>
          r.platform === "TV" ? r.audienceTotal + r.gmmAudience : r.views,
      )
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
    [executiveRows],
  );
  const platformPie = useMemo(
    () =>
      sumBy(
        executiveRows,
        (r) => r.platform,
        (r) =>
          r.platform === "TV" ? r.audienceTotal + r.gmmAudience : r.views,
      )
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
    [executiveRows],
  );
  const vdoTypePie = useMemo(
    () =>
      sumBy(
        executiveRows,
        (r) => r.vdoType,
        (r) =>
          r.platform === "TV" ? r.audienceTotal + r.gmmAudience : r.views,
      )
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
    [executiveRows],
  );
  const digitalFiltered = useMemo(
    () => filtered.filter((r) => r.platform !== "TV"),
    [filtered],
  );
  const tvMode = platform === "TV";
  const performanceFiltered = useMemo(
    () =>
      tvMode ? filtered.filter((r) => r.platform === "TV") : digitalFiltered,
    [tvMode, filtered, digitalFiltered],
  );
  const performanceValue = (r: RecordRow) =>
    tvMode ? r.audienceTotal + r.gmmAudience : r.views;
  const metrics = useMemo(() => {
    const digitalViews = digitalFiltered.reduce((a, r) => a + r.views, 0),
      views = performanceFiltered.reduce(
        (a, r) => a + (tvMode ? r.audienceTotal + r.gmmAudience : r.views),
        0,
      ),
      engagement = performanceFiltered.reduce((a, r) => a + r.engagement, 0),
      uploads = performanceFiltered.reduce((a, r) => a + r.uploadCount, 0),
      tvRows = filtered.filter((r) => r.platform === "TV" || r.ratingTotal > 0 || r.gmmRating > 0),
      one31Rows = tvRows.filter((r) => r.ratingTotal > 0),
      gmm25Rows = tvRows.filter((r) => r.gmmRating > 0),
      ratingAvgOne31 = one31Rows.length
        ? one31Rows.reduce((a, r) => a + r.ratingTotal, 0) / one31Rows.length
        : 0,
      ratingAvgGmm25 = gmm25Rows.length
        ? gmm25Rows.reduce((a, r) => a + r.gmmRating, 0) / gmm25Rows.length
        : 0,
      ratingAvg = tvRows.length
        ? tvRows.reduce((a, r) => a + r.ratingTotal, 0) / tvRows.length
        : 0,
      tvAudience = tvRows.reduce(
        (a, r) => a + r.audienceTotal + r.gmmAudience,
        0,
      ),
      totalCombinedViews = digitalViews + tvAudience,
      one31Episodes = one31Rows.length,
      gmm25Episodes = gmm25Rows.length,
      tvEpisodes = one31Episodes + gmm25Episodes,
      tvBroadcastDays = tvRows.length,
      days = new Set(performanceFiltered.map((r) => r.date)).size || 1,
      sortedDates = [...new Set(performanceFiltered.map((r) => r.date).filter(Boolean))].sort(),
      latestDate = sortedDates.at(-1) || "",
      latestDayRows = latestDate ? performanceFiltered.filter((r) => r.date === latestDate) : [],
      latestUploads = latestDayRows.reduce((a, r) => a + r.uploadCount, 0),
      latestUploadByPlatform = [...sumBy(latestDayRows, (r) => r.platform, (r) => r.uploadCount)]
        .filter((x) => x.total > 0)
        .sort((a, b) => b.total - a.total),
      uploadByPlatform = [...sumBy(performanceFiltered, (r) => r.platform, (r) => r.uploadCount)]
        .sort((a, b) => b.total - a.total),
      digitalViewsByPlatform = [...sumBy(digitalFiltered, (r) => r.platform, (r) => r.views)]
        .filter((x) => x.total > 0)
        .sort((a, b) => b.total - a.total),
      digitalContentByPlatform = [...sumBy(digitalFiltered, (r) => r.platform, () => 1)]
        .sort((a, b) => b.total - a.total);
    return {
      views,
      digitalViews,
      totalCombinedViews,
      engagement,
      uploads,
      latestDate,
      latestUploads,
      latestUploadByPlatform,
      uploadByPlatform,
      digitalViewsByPlatform,
      digitalContentByPlatform,
      ratingAvg,
      ratingAvgOne31,
      ratingAvgGmm25,
      one31Episodes,
      gmm25Episodes,
      tvBroadcastDays,
      tvAudience,
      tvEpisodes,
      tvAudienceAvg: tvEpisodes ? tvAudience / tvEpisodes : 0,
      engagementRate: views ? engagement / views : 0,
      avgDaily: views / days,
    };
  }, [performanceFiltered, filtered, digitalFiltered, tvMode]);
  const chartGrain = useMemo<"day" | "month" | "year">(
    () =>
      tvMode
        ? startDate && endDate && startDate.slice(0, 7) === endDate.slice(0, 7)
          ? "day"
          : "month"
        : grain,
    [tvMode, startDate, endDate, grain],
  );
  const daily = useMemo(() => {
    const m = new Map<string, Record<string, number | string | string[]>>();
    performanceFiltered.forEach((r) => {
      const key =
        chartGrain === "year"
          ? r.date.slice(0, 4)
          : chartGrain === "month"
            ? r.date.slice(0, 7)
            : r.date;
      const x = m.get(key) || { date: key, topics: [] };
      const series = tvMode ? "TV Audience" : r.vdoType;
      x[series] =
        n(x[series]) + (tvMode ? r.audienceTotal + r.gmmAudience : r.views);
      const topicList = x.topics as string[];
      if (r.topic && !topicList.includes(r.topic)) topicList.push(r.topic);
      m.set(key, x);
    });
    return [...m.values()]
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(chartGrain === "day" ? -31 : -24);
  }, [performanceFiltered, chartGrain, tvMode]);
  const types = useMemo(
    () =>
      sumBy(
        performanceFiltered,
        (r) => (tvMode ? "TV Audience" : r.vdoType),
        (r) => (tvMode ? r.audienceTotal + r.gmmAudience : r.views),
      )
        .sort((a, b) => b.total - a.total)
        .slice(0, 7),
    [performanceFiltered, tvMode],
  );
  const topics = useMemo(
    () =>
      sumBy(
        performanceFiltered,
        (r) => r.topicType,
        (r) => (tvMode ? r.audienceTotal + r.gmmAudience : r.views),
      )
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
    [performanceFiltered, tvMode],
  );
  const platforms = useMemo(
    () =>
      sumBy(
        performanceFiltered,
        (r) => r.platform,
        (r) => (tvMode ? r.audienceTotal + r.gmmAudience : r.views),
      ).sort((a, b) => b.total - a.total),
    [performanceFiltered, tvMode],
  );
  const programs = useMemo(
    () =>
      sumBy(
        performanceFiltered,
        (r) => r.program,
        (r) => (tvMode ? r.audienceTotal + r.gmmAudience : r.views),
      ).sort((a, b) => b.total - a.total),
    [performanceFiltered, tvMode],
  );
  const topSource = useMemo(
    () =>
      vdoType === "ALL" && topVdoType !== "ALL"
        ? performanceFiltered.filter((r) => r.vdoType === topVdoType)
        : performanceFiltered,
    [performanceFiltered, vdoType, topVdoType],
  );
  const top = useMemo(
    () =>
      [...topSource]
        .sort(
          (a, b) =>
            (tvMode ? b.audienceTotal + b.gmmAudience : b.views) -
            (tvMode ? a.audienceTotal + a.gmmAudience : a.views),
        )
        .slice(0, 10),
    [topSource, tvMode],
  );
  const best = useMemo(
    () =>
      [...performanceFiltered]
        .filter((r) => (tvMode ? r.audienceTotal + r.gmmAudience : r.views) > 0)
        .sort(
          (a, b) =>
            (tvMode ? b.audienceTotal + b.gmmAudience : b.views) -
            (tvMode ? a.audienceTotal + a.gmmAudience : a.views),
        )
        .slice(0, 5),
    [performanceFiltered, tvMode],
  );
  const rating = useMemo(() => {
    const m = new Map<
      string,
      {
        date: string;
        total: number;
        bkk: number;
        urban: number;
        bu: number;
        rural: number;
        count: number;
      }
    >();
    filtered
      .filter((r) => r.platform === "TV" || r.ratingTotal > 0)
      .forEach((r) => {
        const key =
          ratingGrain === "year"
            ? r.date.slice(0, 4)
            : ratingGrain === "month"
              ? r.date.slice(0, 7)
              : r.date;
        const x = m.get(key) || {
          date: key,
          total: 0,
          bkk: 0,
          urban: 0,
          bu: 0,
          rural: 0,
          count: 0,
        };
        x.total += r.ratingTotal;
        x.bkk += r.ratingBkk;
        x.urban += r.ratingUrban;
        x.bu += r.ratingBkkUrban;
        x.rural += r.ratingRural;
        x.count++;
        m.set(key, x);
      });
    return [...m.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(ratingGrain === "day" ? -31 : -24)
      .map((x) => ({
        date: x.date,
        Total: x.count ? x.total / x.count : 0,
        "15+BKK": x.count ? x.bkk / x.count : 0,
        "15+URBAN": x.count ? x.urban / x.count : 0,
        "15+BKK&URBAN": x.count ? x.bu / x.count : 0,
        "15+RURAL": x.count ? x.rural / x.count : 0,
      }));
  }, [filtered, ratingGrain]);
  const tvAudience = useMemo(() => {
    const m = new Map<
      string,
      { date: string; ONE31: number; GMM25: number; topics: string[] }
    >();
    filtered
      .filter((r) => r.platform === "TV" || r.ratingTotal > 0)
      .forEach((r) => {
        const x = m.get(r.date) || {
          date: r.date,
          ONE31: 0,
          GMM25: 0,
          topics: [],
        };
        x.ONE31 += r.audienceTotal;
        x.GMM25 += r.gmmAudience;
        if (r.topic && !x.topics.includes(r.topic)) x.topics.push(r.topic);
        m.set(r.date, x);
      });
    return [...m.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-31);
  }, [filtered]);
  const tvRatingBreakdown = useMemo(() => {
    const m = new Map<string, { program: string; channel: string; rating: number; audience: number; episodes: number }>();
    filtered.filter((r) => r.platform === "TV" || r.ratingTotal > 0).forEach((r) => {
      const channel = /gmm/i.test(r.channel) ? "GMM25" : /one/i.test(r.channel) ? "One31" : r.channel || "ไม่ระบุช่อง";
      const key = `${r.program}|${channel}`;
      const x = m.get(key) || { program: r.program, channel, rating: 0, audience: 0, episodes: 0 };
      x.rating += r.ratingTotal;
      x.audience += r.audienceTotal + r.gmmAudience;
      x.episodes += 1;
      m.set(key, x);
    });
    return [...m.values()].map((x) => ({ ...x, rating: x.episodes ? x.rating / x.episodes : 0 })).sort((a, b) => b.audience - a.audience);
  }, [filtered]);

  const compare = useMemo(() => {
    type Cluster = CompareRow & { matchTopic: string; hasTv: boolean };
    const byDate = new Map<string, RecordRow[]>();
    filtered.forEach((r) =>
      byDate.set(r.date, [...(byDate.get(r.date) || []), r]),
    );
    const result: CompareRow[] = [];
    const addMetrics = (x: Cluster, r: RecordRow) => {
      if (r.platform === "TV") {
        x.one = r.ratingTotal;
        x.gmm = r.gmmRating;
        x.oneAudience += r.audienceTotal;
        x.gmmAudience += r.gmmAudience;
        x.hasTv = true;
        if (r.topic) {
          x.topic = r.topic;
          x.matchTopic = r.topic;
        }
        if (r.channel) x.page = r.channel;
      } else if (r.platform === "YouTube") x.youtube += r.views;
      else if (r.platform === "Facebook" || r.platform === "Instagram")
        x.facebook += r.views;
      else if (r.platform === "TikTok") x.tiktok += r.views;
      x.engagement += r.engagement;
    };
    for (const [date, dateRows] of byDate) {
      const clusters: Cluster[] = [];
      const ordered = [...dateRows].sort(
        (a, b) =>
          (a.platform === "TV" ? -1 : 1) - (b.platform === "TV" ? -1 : 1),
      );
      for (const r of ordered) {
        const meaningfulProgram =
          r.program && r.program !== "ไม่ระบุ" && r.program !== "ไม่ระบุรายการ";
        let target = meaningfulProgram
          ? clusters.find((x) => x.hasTv && x.program === r.program)
          : undefined;
        if (!target) {
          let best: Cluster | undefined,
            bestScore = 0;
          for (const x of clusters) {
            if (meaningfulProgram && x.program !== r.program) continue;
            const score = topicSimilarity(r.topic || r.episodeId, x.matchTopic);
            if (score > bestScore) {
              best = x;
              bestScore = score;
            }
          }
          if (best && bestScore >= 0.24) target = best;
        }
        if (!target) {
          target = {
            date,
            topic: r.topic || r.episodeId,
            matchTopic: r.topic || r.episodeId,
            program: r.program,
            one: 0,
            gmm: 0,
            oneAudience: 0,
            gmmAudience: 0,
            youtube: 0,
            facebook: 0,
            tiktok: 0,
            engagement: 0,
            page: r.channel,
            hasTv: false,
          };
          clusters.push(target);
        }
        addMetrics(target, r);
      }
      result.push(
        ...clusters.map(({ matchTopic: _, hasTv: __, ...row }) => row),
      );
    }
    return result;
  }, [filtered]);
  const compareSorted = useMemo(
    () =>
      [...compare].sort((a, b) => {
        const av = a[compareSort],
          bv = b[compareSort];
        const result =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv), "th");
        return compareDirection === "asc" ? result : -result;
      }),
    [compare, compareSort, compareDirection],
  );
  const comparePageCount = Math.max(
    1,
    Math.ceil(compareSorted.length / comparePageSize),
  );
  const compareRows = useMemo(
    () =>
      compareSorted.slice(
        (comparePage - 1) * comparePageSize,
        comparePage * comparePageSize,
      ),
    [compareSorted, comparePage, comparePageSize],
  );
  useEffect(
    () => setComparePage(1),
    [
      program,
      platform,
      vdoType,
      topicType,
      startDate,
      endDate,
      search,
      comparePageSize,
    ],
  );
  useEffect(() => {
    if (comparePage > comparePageCount) setComparePage(comparePageCount);
  }, [comparePage, comparePageCount]);
  function sortCompare(key: CompareSortKey) {
    if (compareSort === key)
      setCompareDirection((x) => (x === "asc" ? "desc" : "asc"));
    else {
      setCompareSort(key);
      setCompareDirection(
        key === "date" || typeof compare[0]?.[key] === "number"
          ? "desc"
          : "asc",
      );
    }
    setComparePage(1);
  }
  const platformAnalysis = useMemo(
    () =>
      [...new Set(digitalFiltered.map((r) => r.platform))]
        .map((name) => {
          const items = digitalFiltered.filter(
              (r) => r.platform === name && r.views > 0,
            ),
            top = [...items].sort((a, b) => b.views - a.views)[0],
            format = bestFormat(items),
            topic = sumBy(
              items,
              (r) => r.topicType,
              (r) => r.views,
            ).sort((a, b) => b.total - a.total)[0];
          return { name, top, format, topic: topic?.name || "ข้อมูลยังไม่พอ" };
        })
        .filter((x) => x.top)
        .sort((a, b) => (b.top?.views || 0) - (a.top?.views || 0)),
    [digitalFiltered],
  );
  const provinceRating = useMemo(() => {
    const tv = filtered.filter((r) => r.platform === "TV" || r.ratingTotal > 0);
    const count = tv.length || 1;
    const totals = [
      {
        zone: "15+BKK",
        rating: tv.length ? tv.reduce((a, r) => a + r.ratingBkk, 0) / count : 0,
        source: "15+BKK",
      },
      {
        zone: "15+BKK&URBAN",
        rating: tv.length ? tv.reduce((a, r) => a + r.ratingBkkUrban, 0) / count : 0,
        source: "15+BKK&URBAN",
      },
      {
        zone: "15+URBAN",
        rating: tv.length ? tv.reduce((a, r) => a + r.ratingUrban, 0) / count : 0,
        source: "15+URBAN",
      },
      {
        zone: "15+RURAL",
        rating: tv.length ? tv.reduce((a, r) => a + r.ratingRural, 0) / count : 0,
        source: "15+RURAL",
      },
    ];
    return totals;
  }, [filtered]);
  const topicTrend = useMemo(() => {
    const dates = digitalFiltered
        .map((r) => r.date)
        .filter(Boolean)
        .sort(),
      max = dates.at(-1);
    if (!max) return [];
    const end = new Date(`${max}T00:00:00Z`),
      recentStart = new Date(end);
    recentStart.setUTCDate(recentStart.getUTCDate() - 29);
    const previousStart = new Date(recentStart);
    previousStart.setUTCDate(previousStart.getUTCDate() - 30);
    const rs = isoDate(recentStart),
      ps = isoDate(previousStart);
    const grouped = new Map<
      string,
      { name: string; total: number; recent: number; previous: number }
    >();
    digitalFiltered.forEach((r) => {
      const x = grouped.get(r.topicType) || {
        name: r.topicType,
        total: 0,
        recent: 0,
        previous: 0,
      };
      x.total += r.views;
      if (r.date >= rs) x.recent += r.views;
      else if (r.date >= ps) x.previous += r.views;
      grouped.set(r.topicType, x);
    });
    return [...grouped.values()]
      .map((x) => ({
        ...x,
        growth: x.previous
          ? (x.recent - x.previous) / x.previous
          : x.recent
            ? 1
            : 0,
      }))
      .sort((a, b) => b.recent - a.recent)
      .slice(0, 5);
  }, [digitalFiltered]);
  const q4Plan = useMemo(() => {
    const dates = digitalFiltered
        .map((r) => r.date)
        .filter(Boolean)
        .sort(),
      max = dates.at(-1);
    if (!max) return { topics: [], formats: [] };
    const start = new Date(`${max}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 89);
    const recent = digitalFiltered.filter((r) => r.date >= isoDate(start));
    const topics = sumBy(
      recent,
      (r) => r.topicType,
      (r) => r.views,
    )
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
    const formats = [...new Set(recent.map((r) => r.platform))]
      .map((platform) => ({
        platform,
        format: bestFormat(recent.filter((r) => r.platform === platform)),
      }))
      .filter((x) => x.format)
      .sort((a, b) => (b.format?.avgViews || 0) - (a.format?.avgViews || 0))
      .slice(0, 3);
    return { topics, formats };
  }, [digitalFiltered]);
  const insights = useMemo(() => {
    const t = top[0],
      p = platforms[0],
      e = tvMode
        ? undefined
        : [...performanceFiltered]
            .filter((r) => r.views >= 1000)
            .sort((a, b) => b.engagementRate - a.engagementRate)[0];
    return [
      t
        ? `${tvMode ? "รายการ TV" : "คลิป"} ยอดสูงสุด “${t.topic.slice(0, 68)}” ทำ ${compact(tvMode ? t.audienceTotal + t.gmmAudience : t.views)} ${tvMode ? "Audience" : "Views"}`
        : "ยังไม่มี Top Content",
      p
        ? `${p.name} คิดเป็น ${metrics.views ? ((p.total / metrics.views) * 100).toFixed(1) : 0}% ของข้อมูลที่เลือก`
        : "ยังไม่มีข้อมูลแพลตฟอร์ม",
      e
        ? `Engagement เด่น “${e.topic.slice(0, 58)}” ทำ ${pct(e.engagementRate)} — ควรต่อยอดรูปแบบ ${e.vdoType}`
        : tvMode
          ? "TV Audience แสดงจาก ONE31 + GMM25 โดยไม่คูณ Rating"
          : "ยังไม่มีข้อมูล Engagement เพียงพอ",
    ];
  }, [top, platforms, performanceFiltered, metrics.views, tvMode]);
  function applyRows(raw: RawRow[], name: string, fileTimestamp?: string) {
    const x = normalizeRowsWithDeduplication(raw);
    if (!x.length) throw new Error("ไม่พบข้อมูลที่มีคอลัมน์ Date");
    setRawRows(raw);
    const d = x.map((r) => r.date).sort();
    setRows(x);
    setStartDate(d[0]);
    setEndDate(d.at(-1) || d[0]);
    setSourceName(name);
    setUploadedAt(fileTimestamp || new Date().toISOString());
    setMessage(`นำเข้า ${num(x.length)} แถวเรียบร้อย (สามารถกดบันทึกขึ้น Cloud ได้)`);
    setSourceOpen(false);
  }

  async function saveCurrentDataToCloud(userRole?: string): Promise<{ success: boolean; message: string }> {
    if (userRole !== "admin") {
      const msg = "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถบันทึกข้อมูลขึ้น Cloud ได้ (กรุณาเข้าสู่ระบบด้วยสิทธิ์ Admin)";
      setMessage(msg);
      throw new Error(msg);
    }

    const dataToSave = rawRows.length > 0 ? rawRows : (rows as unknown as RawRow[]);
    if (!dataToSave.length) {
      const msg = "ไม่มีข้อมูลสำหรับบันทึก";
      setMessage(msg);
      throw new Error(msg);
    }

    setCloudSaving(true);
    setCloudSaveProgress(null);
    setMessage("กำลังบันทึกข้อมูลขึ้น Firebase Firestore...");

    try {
      const result = await saveMasterDataToFirebase(dataToSave, (current, total) => {
        setCloudSaveProgress({ current, total });
      });
      setSourceName("Firebase Firestore");
      setUploadedAt(new Date().toISOString());
      setMessage(result.message);
      return { success: true, message: result.message };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "บันทึกข้อมูลขึ้น Cloud ไม่สำเร็จ";
      setMessage(`เกิดข้อผิดพลาด: ${errorMsg}`);
      throw new Error(errorMsg);
    } finally {
      setCloudSaving(false);
      setCloudSaveProgress(null);
    }
  }
  async function loadSheet(): Promise<{ success: boolean; message: string }> {
    setLoading(true);
    setMessage("");
    try {
      const id = sheetUrl.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1],
        gid = sheetUrl.match(/[?&#]gid=(\d+)/)?.[1] || "0";
      const url = id
        ? `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`
        : sheetUrl;
      const r = await fetch(url);
      if (!r.ok) throw new Error("ไม่สามารถเปิด Google Sheet ได้ (โปรดตรวจสอบว่าตั้งค่าแชร์เป็น 'ทุกคนที่มีลิงก์ดูได้' หรือยัง)");
      const text = await r.text();
      const parsed = parseCsv(text);
      if (!parsed || parsed.length === 0) {
        throw new Error("ไม่พบข้อมูลใน Google Sheet ที่ระบุ");
      }
      applyRows(parsed, "Google Sheets");
      const successMsg = `นำเข้า ${num(parsed.length)} แถวจาก Google Sheets สำเร็จ`;
      return { success: true, message: successMsg };
    } catch (e) {
      const err = e instanceof Error ? e.message : "นำเข้าไม่สำเร็จ";
      setMessage(err);
      return { success: false, message: err };
    } finally {
      setLoading(false);
    }
  }
  async function onFile(file?: File): Promise<{ success: boolean; message: string }> {
    if (!file) return { success: false, message: "ไม่ได้เลือกไฟล์" };
    setLoading(true);
    setMessage("");
    try {
      const fileTimestamp = file.lastModified
        ? new Date(file.lastModified).toISOString()
        : new Date().toISOString();

      let parsedRows: RawRow[] = [];

      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        parsedRows = parseCsv(text);
      } else {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer(), {
          type: "array",
          cellDates: true,
        });
        const shName =
          wb.SheetNames.find((x) => x.toLowerCase().includes("master")) ||
          wb.SheetNames[0];
        const sh = wb.Sheets[shName];
        if (!sh) throw new Error("ไม่พบ Sheet ข้อมูลในไฟล์ Excel");
        parsedRows = XLSX.utils.sheet_to_json(sh, { defval: null }) as RawRow[];
      }

      if (!parsedRows || parsedRows.length === 0) {
        throw new Error("ไฟล์ที่เลือกไม่มีข้อมูล หรือรูปแบบแถวว่างเปล่า");
      }

      applyRows(parsedRows, file.name, fileTimestamp);
      const successMsg = `นำเข้าไฟล์ ${file.name} จำนวน ${num(parsedRows.length)} รายการสำเร็จ`;
      return { success: true, message: successMsg };
    } catch (e) {
      const err = e instanceof Error ? e.message : "อ่านไฟล์ไม่สำเร็จ";
      setMessage(err);
      return { success: false, message: err };
    } finally {
      setLoading(false);
    }
  }
  async function checkIntegrations() {
    if (isStaticHost) {
      setMessage("เวอร์ชัน GitHub Pages รองรับรายงานและนำเข้าไฟล์เท่านั้น ไม่รองรับ API Sync");
      return;
    }
    setIntegrationLoading(true);
    try {
      const response = await fetch("/api/integrations/status", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("ตรวจสอบการตั้งค่าไม่สำเร็จ");
      setIntegrationStatus((await response.json()) as IntegrationMap);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "ตรวจสอบ API ไม่สำเร็จ");
    } finally {
      setIntegrationLoading(false);
    }
  }
  function openIntegrations() {
    setIntegrationsOpen(true);
    setMenuOpen(false);
    void checkIntegrations();
  }
  function applyDatePreset(value: DatePreset) {
    setDatePreset(value);
    if (value === "CUSTOM") return;
    if (value === "ALL") {
      const dates = rows.map((r) => r.date).sort();
      setStartDate(dates[0] || "");
      setEndDate(dates.at(-1) || "");
      return;
    }
    const latestYear = Number(
      (
        rows
          .map((r) => r.date)
          .sort()
          .at(-1) ||
        endDate ||
        String(new Date().getFullYear())
      ).slice(0, 4),
    );
    const [start, end] = getDatePresetRange(value, latestYear);
    setStartDate(start);
    setEndDate(end);
  }
  function download() {
    const h = [
        "Date",
        "Program",
        "Topic",
        "Topic Type",
        "VDO Type",
        "Platform",
        "Channel",
        "Digital Views",
        "Engagement",
        "Engagement Rate",
        "TV Rating Score",
      ],
      body = filtered.map((r) => [
        r.date,
        r.program,
        r.topic,
        r.topicType,
        r.vdoType,
        r.platform,
        r.channel,
        r.platform === "TV" ? 0 : r.views,
        r.engagement,
        r.engagementRate,
        r.ratingTotal,
      ]);
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const blob = new Blob(
      [[h, ...body].map((r) => r.map(esc).join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `performance-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function reset() {
    setProgram("ALL");
    setPlatform("ALL");
    setVdoType("ALL");
    setTopicType("ALL");
    setSearch("");
    setDatePreset("ALL");
    const d = rows.map((r) => r.date).sort();
    setStartDate(d[0] || "");
    setEndDate(d.at(-1) || "");
  }
  return {
    rows,
    setRows,
    loading,
    setLoading,
    menuOpen,
    setMenuOpen,
    sourceOpen,
    setSourceOpen,
    integrationsOpen,
    setIntegrationsOpen,
    integrationLoading,
    setIntegrationLoading,
    integrationStatus,
    setIntegrationStatus,
    sheetUrl,
    setSheetUrl,
    sourceName,
    setSourceName,
    uploadedAt,
    setUploadedAt,
    message,
    setMessage,
    program,
    setProgram,
    platform,
    setPlatform,
    vdoType,
    setVdoType,
    topicType,
    setTopicType,
    search,
    setSearch,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    datePreset,
    setDatePreset,
    topVdoType,
    setTopVdoType,
    grain,
    setGrain,
    ratingGrain,
    setRatingGrain,
    fileRef,
    executiveChartType,
    setExecutiveChartType,
    comparePage,
    setComparePage,
    comparePageSize,
    setComparePageSize,
    compareSort,
    setCompareSort,
    compareDirection,
    setCompareDirection,
    options,
    filtered,
    executiveRows,
    executiveGrain,
    digitalVsTv,
    programPie,
    platformPie,
    vdoTypePie,
    digitalFiltered,
    tvMode,
    performanceFiltered,
    performanceValue,
    metrics,
    chartGrain,
    daily,
    types,
    topics,
    platforms,
    programs,
    topSource,
    top,
    best,
    rating,
    tvAudience,
    tvRatingBreakdown,
    compare,
    compareSorted,
    comparePageCount,
    compareRows,
    sortCompare,
    platformAnalysis,
    provinceRating,
    topicTrend,
    q4Plan,
    insights,
    applyRows,
    loadSheet,
    onFile,
    checkIntegrations,
    openIntegrations,
    rawRows,
    cloudSaving,
    cloudSaveProgress,
    saveCurrentDataToCloud,
    applyDatePreset,
    download,
    reset,
  };
}
export type DashboardModel = ReturnType<typeof useDashboard>;
