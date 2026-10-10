"use client";
// วิเคราะห์คลิป → คอมเมนต์: what people wrote under the clip on YouTube and
// Facebook, from the daily sync (lib/commentsData.ts). Most liked or newest,
// 10 / 20 / all. Hidden for people without วิเคราะห์เชิงลึก (Firestore refuses the read).
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, ThumbsUp } from "lucide-react";
import type { RecordRow } from "@/lib/dashboard/types";
import { postId } from "@/lib/dashboard/postKey";
import { loadClipComments, type ClipComments as Comments, type CommentItem } from "@/lib/commentsData";
import { track } from "@/lib/loadingBar";

const PLATFORMS = ["YouTube", "Facebook"] as const;
const COUNTS = [10, 20, 0] as const; // 0 = ทั้งหมด
const AVATAR_COLORS = ["#f97316", "#0ea5e9", "#22c55e", "#a855f7", "#ef4444", "#14b8a6", "#eab308", "#6366f1"];

/** "3 วันที่แล้ว" / "5 ชม.ที่แล้ว" from an ISO time. */
function ago(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 60) return `${min || 1} นาทีที่แล้ว`;
  if (min < 48 * 60) return `${Math.round(min / 60)} ชม.ที่แล้ว`;
  if (min < 60 * 24 * 60) return `${Math.round(min / 1440)} วันที่แล้ว`;
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" }).format(new Date(t));
}
const initialOf = (name: string) => (name.replace(/^@/, "").trim().charAt(0) || "?").toUpperCase();

function Avatar({ c, i }: { c: CommentItem; i: number }) {
  const [broken, setBroken] = useState(false);
  if (c.avatar && !broken) return <img className="cmt-av" src={c.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  return (
    <span className="cmt-av" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }} aria-hidden>
      {initialOf(c.name)}
    </span>
  );
}

export function ClipComments({ posts }: { posts: RecordRow[] }) {
  // The clip's YouTube / Facebook posts (one each, the most viewed).
  const targets = useMemo(() => {
    const out: { platform: (typeof PLATFORMS)[number]; id: string }[] = [];
    for (const p of PLATFORMS) {
      const row = posts.filter((r) => r.platform === p).sort((a, b) => b.views - a.views)[0];
      const id = row ? postId(p, row.url) || postId(p, row.contentId) : "";
      if (id) out.push({ platform: p, id });
    }
    return out;
  }, [posts]);
  // Loaded comments, tagged with the posts they belong to (another clip = loading again).
  const key = targets.map((t) => `${t.platform}:${t.id}`).join(",");
  const [loaded, setLoaded] = useState<{ key: string; data: Record<string, Comments | null> | "denied" } | null>(null);
  const data = loaded && loaded.key === key ? loaded.data : null;
  const [pick, setPick] = useState<string>("");
  const [order, setOrder] = useState<"top" | "latest">("top");
  const [count, setCount] = useState<number>(10);

  useEffect(() => {
    if (!targets.length) return;
    let alive = true;
    track(Promise.all(targets.map((t) => loadClipComments(t.platform, t.id))))
      .then((list) => {
        if (!alive) return;
        if (list.includes("denied")) return setLoaded({ key, data: "denied" });
        const m: Record<string, Comments | null> = {};
        targets.forEach((t, i) => (m[t.platform] = list[i] as Comments | null));
        setLoaded({ key, data: m });
        setPick(targets.find((t) => m[t.platform])?.platform || targets[0].platform);
      })
      .catch(() => alive && setLoaded({ key, data: {} }));
    return () => {
      alive = false;
    };
  }, [key, targets]);

  if (!targets.length || data === "denied") return null;
  const current = data && pick ? data[pick] : null;
  const canTop = pick === "YouTube" && !!current?.top?.length;
  const view = canTop ? order : "latest";
  const all = current ? (view === "top" ? current.top : current.latest) || [] : [];
  const list = count ? all.slice(0, count) : all;

  return (
    <section className="clip-detail-box cmt">
      <div className="cmt-head">
        <h3>
          <MessageCircle size={15} /> คอมเมนต์
        </h3>
        <div className="cmt-tools">
          {targets.length > 1 && (
            <div className="segmented" role="group" aria-label="แพลตฟอร์ม">
              {targets.map((t) => (
                <button key={t.platform} className={pick === t.platform ? "active" : ""} onClick={() => setPick(t.platform)}>
                  {t.platform}
                </button>
              ))}
            </div>
          )}
          <div className="segmented" role="group" aria-label="เรียงตาม">
            <button className={view === "top" ? "active" : ""} disabled={!canTop} title={canTop ? "" : "Facebook ไม่ส่งจำนวนถูกใจของคอมเมนต์มา"} onClick={() => setOrder("top")}>
              ถูกใจมากที่สุด
            </button>
            <button className={view === "latest" ? "active" : ""} onClick={() => setOrder("latest")}>
              ล่าสุด
            </button>
          </div>
          <div className="segmented" role="group" aria-label="จำนวนที่แสดง">
            {COUNTS.map((n) => (
              <button key={n} className={count === n ? "active" : ""} onClick={() => setCount(n)}>
                {n || "ทั้งหมด"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {data === null ? (
        <p className="audience-note">กำลังโหลดคอมเมนต์…</p>
      ) : !current ? (
        <p className="audience-note">
          ยังไม่มีคอมเมนต์ของคลิปนี้ใน {pick} · ระบบเก็บเฉพาะ YouTube 100 คลิปวิวสูงสุดใน 30 วัน และ Facebook โพสต์ล่าสุดที่ Metricool ส่งมา
        </p>
      ) : !list.length ? (
        <p className="audience-note">ไม่มีคอมเมนต์ที่มีเนื้อหาในรายการนี้</p>
      ) : (
        <ol className="cmt-list">
          {list.map((c, i) => (
            <li key={c.id}>
              <Avatar c={c} i={i} />
              <div>
                <div className="cmt-who">
                  {c.link ? (
                    <a href={c.link} target="_blank" rel="noreferrer">
                      {c.name || `ผู้ใช้ ${pick}`}
                    </a>
                  ) : (
                    <b>{c.name || `ผู้ใช้ ${pick}`}</b>
                  )}
                  <span> · {ago(c.at)}</span>
                </div>
                <p className="cmt-text">{c.text}</p>
                {c.likes !== null && (
                  <span className="cmt-like">
                    <ThumbsUp size={12} /> {c.likes.toLocaleString("en-US")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {current && (
        <p className="audience-note">
          แสดง {list.length} จาก {all.length} อันที่เก็บไว้{current.total ? ` · คอมเมนต์ทั้งหมดบน ${pick} ${current.total.toLocaleString("en-US")} อัน` : ""} · ข้อมูล ณ {ago(current.updatedAt)}
          {pick === "Facebook" ? " · Facebook ไม่ส่งจำนวนถูกใจของคอมเมนต์ จึงเรียงได้เฉพาะล่าสุด" : " · “ล่าสุด” ไม่นับข้อความสั้นมากหรืออีโมจิล้วน"}
        </p>
      )}
    </section>
  );
}
