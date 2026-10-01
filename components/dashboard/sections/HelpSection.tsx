"use client";
// คู่มือ & FAQ: how to use and read the dashboard (text in lib/help/content.ts).
// Admin-only topics and answers are shown to admins only.
import { useMemo, useState } from "react";
import { ChevronDown, CircleHelp, Search } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { HELP_FAQ, HELP_TOPICS, type HelpTopic } from "@/lib/help/content";

/** "?" beside a section heading: opens the matching help topic. */
export function HelpLink({ topic, label = "วิธีอ่านส่วนนี้" }: { topic: string; label?: string }) {
  return (
    <a
      className="help-link"
      href={`#help-${topic}`}
      title={label}
      aria-label={label}
      onClick={(e) => {
        // Same topic twice leaves the hash unchanged, so announce it ourselves.
        e.preventDefault();
        window.history.replaceState(null, "", `#help-${topic}`);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }}
    >
      <CircleHelp size={15} />
    </a>
  );
}

const matches = (text: string, q: string) => !q || text.toLowerCase().includes(q.toLowerCase());
const topicText = (t: HelpTopic) => [t.title, t.lead, ...t.points, ...(t.example || []).map((e) => `${e.label} ${e.note || ""}`)].join(" ");

export function HelpSection({ isAdmin }: { isAdmin: boolean }) {
  const [q, setQ] = useState("");
  const topics = useMemo(() => HELP_TOPICS.filter((t) => (isAdmin || !t.admin) && matches(topicText(t), q)), [isAdmin, q]);
  const faq = useMemo(() => HELP_FAQ.filter((f) => (isAdmin || !f.admin) && matches(`${f.q} ${f.a}`, q)), [isAdmin, q]);
  const titleOf = (id: string) => HELP_TOPICS.find((t) => t.id === id)?.title || id;

  return (
    <section className="panel growth-panel help-panel" id="help">
      <div className="panel-head">
        <div>
          <h2>คู่มือ & FAQ</h2>
          <p className="growth-sub">
            วิธีใช้และวิธีอ่านตัวเลขใน {BRAND.product} · กดปุ่ม <CircleHelp size={13} className="help-inline-icon" /> ข้างหัวข้อในแต่ละหน้าเพื่อมาที่คำอธิบายส่วนนั้น
          </p>
        </div>
        <label className="help-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา เช่น ค่ากลาง, sync, รหัสผ่าน" />
        </label>
      </div>

      {!q && (
        <nav className="help-toc" aria-label="หัวข้อคู่มือ">
          {topics.map((t) => (
            <a key={t.id} href={`#help-${t.id}`} className={t.admin ? "admin" : ""}>
              {t.title}
            </a>
          ))}
          <a href="#help-faq">คำถามที่พบบ่อย</a>
        </nav>
      )}

      <div className="help-topics">
        {topics.map((t) => (
          <article key={t.id} id={`help-${t.id}`} className="help-topic">
            <h3>
              {t.title}
              {t.admin && <span className="help-badge">admin</span>}
            </h3>
            <p className="help-lead">{t.lead}</p>
            <ol>
              {t.points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
            {t.example && (
              <div className="help-example" aria-label="ตัวอย่าง (ตัวเลขสมมติ)">
                {t.example.map((e) => (
                  <div key={e.label}>
                    <small>{e.label}</small>
                    <b>{e.value}</b>
                    {e.note && <span>{e.note}</span>}
                  </div>
                ))}
                <em>ตัวอย่าง · ตัวเลขสมมติ</em>
              </div>
            )}
          </article>
        ))}
      </div>

      <h3 className="help-faq-title" id="help-faq">
        คำถามที่พบบ่อย
      </h3>
      {faq.length ? (
        <div className="help-faq">
          {faq.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <ChevronDown size={15} />
              </summary>
              <p>{f.a}</p>
              {!!f.topics?.length && (
                <p className="help-related">
                  ดูเพิ่ม:{" "}
                  {f.topics
                    .filter((id) => isAdmin || !HELP_TOPICS.find((t) => t.id === id)?.admin)
                    .map((id, i) => (
                      <span key={id}>
                        {i > 0 && " · "}
                        <a href={`#help-${id}`}>{titleOf(id)}</a>
                      </span>
                    ))}
                </p>
              )}
            </details>
          ))}
        </div>
      ) : (
        <p className="growth-notice">ไม่พบคำตอบสำหรับ “{q}” ลองคำอื่น หรือสอบถาม admin</p>
      )}

      {!topics.length && q && <p className="growth-notice">ไม่พบหัวข้อคู่มือสำหรับ “{q}”</p>}
    </section>
  );
}
