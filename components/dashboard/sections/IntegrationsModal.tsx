"use client";
import type { DashboardModel } from "@/hooks/useDashboard";
import { INTEGRATIONS } from "@/lib/dashboard/constants";
import { Database, RefreshCw, X } from "lucide-react";
export function IntegrationsModal({
  integrationsOpen,
  setIntegrationsOpen,
  integrationLoading,
  integrationStatus,
  checkIntegrations,
}: Pick<
  DashboardModel,
  | "integrationsOpen"
  | "setIntegrationsOpen"
  | "integrationLoading"
  | "integrationStatus"
  | "checkIntegrations"
>) {
  return (
    <>
      {integrationsOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setIntegrationsOpen(false)}
        >
          <section
            className="integration-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              onClick={() => setIntegrationsOpen(false)}
            >
              <X />
            </button>
            <div className="integration-heading">
              <div className="modal-icon">
                <Database />
              </div>
              <div>
                <h2>Data Sources & API Sync</h2>
                <p>
                  ตั้งค่าค่าหลักบน Server แล้วระบบจะตรวจสอบความพร้อมโดยไม่แสดง
                  Secret ในหน้าเว็บ
                </p>
              </div>
              <button onClick={checkIntegrations} disabled={integrationLoading}>
                <RefreshCw className={integrationLoading ? "spin" : ""} />
                {integrationLoading ? "กำลังตรวจสอบ" : "ตรวจสอบอีกครั้ง"}
              </button>
            </div>
            <div className="integration-grid">
              {INTEGRATIONS.map((item) => {
                const status = integrationStatus?.[item.id];
                return (
                  <article
                    className="integration-card"
                    key={item.id}
                    style={
                      {
                        "--integration-color": item.color,
                      } as React.CSSProperties
                    }
                  >
                    <header>
                      <i />
                      <div>
                        <h3>{item.name}</h3>
                        <p>{item.detail}</p>
                      </div>
                      <span
                        className={status?.configured ? "ready" : "pending"}
                      >
                        {status?.configured ? "พร้อม Sync" : "ยังไม่ครบ"}
                      </span>
                    </header>
                    <div className="required-fields">
                      <b>ค่าหลักที่ต้องมี</b>
                      {item.fields.map((field, index) => (
                        <div key={field}>
                          <span>{field}</span>
                          <code>{item.keys[index]}</code>
                          <em>
                            {status &&
                            !status.missing.includes(item.keys[index])
                              ? "✓"
                              : "—"}
                          </em>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="sync-policy">
              <b>Sync Policy</b>
              <span>
                Daily Sync 06:00 · ดึงย้อนหลัง 7 วัน · UPSERT ด้วย Platform +
                Account ID + Content ID
              </span>
              <small>
                ค่าลับต้องบันทึกใน Server Environment เท่านั้น ไม่บันทึกใน
                Browser หรือ Master Data
              </small>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
