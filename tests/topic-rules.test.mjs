import assert from "node:assert/strict";
import test from "node:test";
import { classifyTopic, matchTopic } from "../lib/dashboard/topicRules.ts";
import { inferTopicType } from "../lib/integrations/metricool.ts";

test("short words only in full form: สว. / ส.ส., not สวัสดิการ or คลาสสิก", () => {
  assert.equal(classifyTopic("เบื้องหลัง สว.สีน้ำเงิน เปลี่ยนกฎ"), "ข่าวการเมือง");
  assert.equal(classifyTopic("สส. ที่ดี คุณเองก็เป็นได้"), "ข่าวการเมือง");
  assert.equal(classifyTopic("ควรไปทางไหน ปฏิทินหรือสวัสดิการ"), "ไม่ระบุ");
  assert.equal(classifyTopic("เพลงคลาสสิกฟังสบาย"), "ไม่ระบุ");
  assert.equal(classifyTopic("ประชาธิปัตย์ จับมือ กล้าธรรม ไหม"), "ไม่ระบุ");
});

test("crime is checked before politics; the matching word is reported", () => {
  assert.equal(classifyTopic("ถ้าได้เป็นนายกฯ จะเร่งปฏิรูปวงการตำรวจ"), "ข่าวตำรวจ / อาชญากรรม / สแกมเมอร์");
  assert.deepEqual(matchTopic("ถ้าได้เป็นนายกฯ จะเร่งปฏิรูปวงการตำรวจ"), { topic: "ข่าวตำรวจ / อาชญากรรม / สแกมเมอร์", word: "ตำรวจ" });
  assert.equal(classifyTopic("ทำเลก่อนเปิดร้านอาหารให้ขายดี | เงินทองของจริง"), "การเงิน / ธุรกิจ");
});

test("title first, then the rest of the text; PROMO is a channel promo", () => {
  assert.equal(classifyTopic("ทราย สก๊อต แจงปมโพสต์", "รายการถกไม่เถียง การเมือง"), "ข่าวกระแส / Viral");
  assert.equal(classifyTopic("คุยสบาย ๆ", "เรื่องอิหร่าน"), "ข่าวต่างประเทศ / อิหร่าน–สหรัฐ");
  assert.equal(classifyTopic("อะไรก็ได้", "", "PROMO"), "โปรโมทรายการ");
  assert.equal(inferTopicType("รายละเอียด #การเมือง", "วิโรจน์ลั่น ! บ้านเมืองดีขึ้นหรือยัง"), "ข่าวการเมือง");
});

test("เงินทองของจริง is always finance unless Branded; broad words no longer decide politics", () => {
  assert.equal(classifyTopic("SME ไทย รับมือยังไงเมื่อเจอวิกฤต ?", "", "เงินทองของจริง"), "การเงิน / ธุรกิจ");
  assert.equal(classifyTopic("บริการสภาฯ กดปุ่มเดียว", "", "เงินทองของจริง"), "การเงิน / ธุรกิจ");
  assert.equal(classifyTopic("สปอนเซอร์พิเศษ", "", "เงินทองของจริง"), "งานลูกค้า / งานขอ / Branded Content");
  assert.equal(classifyTopic("มีปืนเยอะผิดไหม? กฎหมายว่าอย่างไร"), "ไม่ระบุ");
  assert.equal(classifyTopic("มาทำตามความฝันที่ประเทศไทย"), "ไม่ระบุ");
  assert.equal(classifyTopic("ซื้อพระเครื่องที่ไหนดี"), "ข่าวพระเครื่อง");
});

test("a single-programme account keeps its programme unless the title names another one", async () => {
  const { programFor } = await import("../lib/integrations/metricoolSync.ts");
  const tk = { mode: "single", program: "ถกไม่เถียง" };
  assert.equal(programFor(tk, "[Highlight] | เงินทองของจริง EP.159", "ไม่ระบุ"), "เงินทองของจริง");
  assert.equal(programFor(tk, "ข่าวการเมืองวันนี้", "ไม่ระบุ"), "ถกไม่เถียง");
  assert.equal(programFor({ mode: "multi" }, "อะไรก็ได้", "Kidsfun"), "Kidsfun");
});
