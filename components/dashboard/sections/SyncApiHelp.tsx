"use client";
// สถานะการ Sync → แหล่งข้อมูลแต่ละบัญชี → (i): how to move an account from Metricool
// to the platform's own API. Steps only; no token, key or code is ever shown or typed here.
import { X } from "lucide-react";

const list = (names: string[]) => (names.length ? names.join(", ") : "ต่อครบแล้ว");

export function SyncApiHelp({
  onClose,
  tiktok,
  meta,
  analytics,
}: {
  onClose: () => void;
  /** Brands still through Metricool, per step. */
  tiktok: string[];
  meta: string[];
  analytics: string[];
}) {
  return (
    <div
      className="modal-backdrop ssm-help-backdrop"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <section className="source-modal ssm-help" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="วิธีเชื่อม API ตรงกับแพลตฟอร์ม">
        <button className="close" onClick={onClose} aria-label="ปิด">
          <X size={18} />
        </button>
        <h2>วิธีเชื่อม API ตรงกับแพลตฟอร์ม</h2>
        <p className="ssm-help-lead">
          ต่อ API แล้วข้อมูลมาตรงจากแพลตฟอร์ม ไม่ต้องรอ Metricool · ต่อเสร็จ รอบ sync ถัดไปช่องในตารางจะเปลี่ยนเป็น <span className="ssm-pill api">API</span> เอง ·
          ห้ามส่ง token, key หรือรหัสในแชตหรืออีเมล
        </p>

        <div className="ssm-help-block">
          <h3>
            TikTok <small>ยังต้องต่อ: {list(tiktok)}</small>
          </h3>
          <ol>
            <li>นัดเจ้าของบัญชี TikTok (คนที่ล็อกอินบัญชีนั้นได้) มาที่เครื่องออฟฟิศพร้อมผู้ดูแลระบบ ทำทีละบัญชี</li>
            <li>
              ผู้ดูแลระบบรัน <code>node scripts/tiktok-auth.mjs url</code> แล้วเปิดลิงก์ที่ได้ในเบราว์เซอร์ของเครื่องนั้น
            </li>
            <li>เจ้าของบัญชีล็อกอิน TikTok แล้วกด "อนุญาต" (ขอแค่อ่านข้อมูลบัญชีและรายการวิดีโอ ไม่โพสต์อะไร)</li>
            <li>
              หน้าเว็บจะเด้งกลับมาที่ dashboard คัดลอก URL บนแถบที่อยู่ใส่ในไฟล์ <code>.env.local</code> บนเครื่องเดียวกัน (ห้ามส่งในแชต) แล้วรัน{" "}
              <code>node scripts/tiktok-auth.mjs exchange</code>
            </li>
            <li>
              รัน <code>node scripts/tiktok-auth.mjs save --brand="ชื่อแบรนด์"</code> ชื่อตามคอลัมน์ "บัญชี" ในตาราง เช่น <code>--brand="HITZ Thailand"</code>
            </li>
            <li>สิทธิ์มีอายุราว 1 ปี ตารางนี้จะเตือนก่อนหมด 30 วัน ให้เจ้าของบัญชีกดอนุญาตใหม่ด้วยขั้นตอนเดิม</li>
          </ol>
        </div>

        <div className="ssm-help-block">
          <h3>
            Facebook / Instagram (Meta) <small>ยังต้องต่อ: {list(meta)}</small>
          </h3>
          <ol>
            <li>ผู้ดูแล Meta Business Manager ของบริษัทเป็นคนทำ ทุกเพจ Facebook และบัญชี Instagram ต้องอยู่ใน Business Manager เดียวกัน</li>
            <li>ที่ developers.facebook.com สร้าง App แบบ Business แล้วผูกกับ Business Manager ของบริษัท</li>
            <li>ใน Business Manager → ผู้ใช้ระบบ (System User) สร้างผู้ใช้ระบบ 1 คน แล้วมอบสิทธิ์เพจและบัญชี Instagram ทั้งหมดให้</li>
            <li>
              สร้าง token ของผู้ใช้ระบบนั้น เลือกสิทธิ์: pages_show_list, pages_read_engagement, read_insights, instagram_basic, instagram_manage_insights,
              business_management (อ่านอย่างเดียว)
            </li>
            <li>ผู้ดูแลระบบใส่ token ใน GitHub → Settings → Secrets ของ repo เอง (ห้ามส่งในแชต)</li>
            <li>แจ้งทีมพัฒนาให้เขียนตัวดึงข้อมูล Meta (ยังไม่มีในระบบ) แล้วเทียบกับ Metricool 1 สัปดาห์ก่อนสลับมาใช้จริง</li>
          </ol>
        </div>

        <div className="ssm-help-block">
          <h3>
            YouTube Analytics (เวลาดู, แชร์) <small>ยังไม่เปิด: {list(analytics)}</small>
          </h3>
          <ol>
            <li>YouTube API ต่อครบทุกช่องแล้ว ส่วนนี้คือข้อมูลเสริมจาก CMS ทำโดยคนที่เป็น admin ของ YouTube CMS</li>
            <li>
              รัน <code>node scripts/youtube-analytics-auth.mjs login --cms=…</code> บนเครื่องออฟฟิศ แล้วล็อกอิน Google ในหน้าที่เปิดขึ้น (ถ้าพอร์ต 8765 ไม่ว่าง ใส่{" "}
              <code>--port=8766</code>)
            </li>
            <li>
              ทดสอบด้วย <code>node scripts/youtube-analytics-auth.mjs check</code> แล้วบันทึกพร้อมรายชื่อช่องที่จะเปิดด้วย{" "}
              <code>save --channels=…</code> (ใส่ทุกช่องที่ต้องการ รวมช่องเดิม)
            </li>
            <li>sync จะใช้เวลานานขึ้นตามจำนวนช่องที่เปิด</li>
          </ol>
        </div>
      </section>
    </div>
  );
}
