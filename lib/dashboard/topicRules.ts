// Topic Type for new posts, from their title: the team's Excel IFS formula with
// fixes (2026-10-05). The first rule whose words appear wins; order matters.
// Measured on the master data the team had labelled: 74.4% the same label
// (the previous rules: 64.4%). Labels the team set themselves are never changed.
//
// Fixes to the formula: short words in full form (สว → สว./ส.ว.), crime before
// politics, no trailing spaces, the system's category names, foreign and Branded
// words from the previous rules, plus names and words common in titles the
// formula left unknown.
//
// Pure, no imports: the sync and Node scripts use it directly.

export const UNKNOWN_TOPIC = "ไม่ระบุ";
export const PROMO_TOPIC = "โปรโมทรายการ";

export const TOPIC_RULES: [topic: string, words: string][] = [
  ["งานลูกค้า / งานขอ / Branded Content", "ลูกค้า|โฆษณา|สปอนเซอร์|branded|promotion|โปรโมชัน"],
  ["พระเครื่อง", "มาดามเก่ง|เซียนพระ|โทนบางแค|พระเครื่อง|วัตถุมงคล|เกจิ"],
  ["ประวัติศาสตร์", "พระนเรศ|กำไรของแผ่นดิน|คำสอนของพ่อ|มรดกทรงคุณค่า|ประวัติศาสตร์"],
  ["ข่าวชาวบ้าน", "กู้ภัย|สายเชีย"],
  ["ข่าวไทย–กัมพูชา", "ฮุน ?เซน|Hun Sen|กัมพูชา|เขมร|ทหาร|Cambodia|กองทัพ"],
  ["ข่าวต่างประเทศ / อิหร่าน–สหรัฐ", "ทรัม|อิหร่าน|สหรัฐ|รัสเซีย|ยูเครน|อิสราเอล|ปูติน|ต่างประเทศ"],
  [
    "ข่าวตำรวจ / อาชญากรรม / สแกมเมอร์",
    "ตำรวจ|คดี|ถูกจับ|จับกุม|จับตัว|รวบตัว|ฆ่า|โกง|สแกมเมอร์|มิจฉาชีพ|ติดคุก|ขืนใจ|สถานบันเทิง|สถานบังเทิง|เมาแล้วขับ|เมาคลั่ง|เสียชีวิต|ศพ|จีนเทา|แอร์สาว|ทุนต่างชาติ|โรงเบีย|อุทาหร|คอลเซ็นเตอร์|police|แก๊งคอล|นักอาชญาวิทยา|พ\\.ต\\.อ\\.|ชักมีดขู่",
  ],
  ["ข่าวบุคคล / การเมืองท้องถิ่น", "ผู้ว่า\\s*กทม|บิ๊กโจ๊ก|การเมืองท้องถิ่น"],
  [
    "ข่าวการเมือง",
    "รัฐบาล|การเมือง|นายก|สภา|ส\\.ส\\.|สส\\.|ส\\.ว\\.|สว\\.|สว สีน้ำเงิน|สวสีน้ำเงิน|กกต|พรรค|ฮั้ว|รัฐประหาร|อภิปราย|เพื่อไทย|ภูมิใจไทย|ประกันสังคม|กระทรวง|ประชาธิปไตย|ชัชชาติ|ซุปเปอร์จี|สุริยะ|เอกสารลับ|บกลายจุด|มัลลิกา|ศุภจี|กฎหมาย|แลนด์บริด|government|economic|กสทช|ฝ่ายค้าน|เทพไท|สนธิ|ยึดเมือง|รธน|วิกฤต|เลือกตั้ง|รัฐมนตรี|อนุทิน",
  ],
  ["การเงิน / ธุรกิจ", "เงินทองของจริง|การเงิน|หุ้น|กองทุน|ภาษี|ค่าใช้จ่าย|ดอกเบี้ย|VAT|ร้านอาหาร|ธุรกิจ"],
  ["ข่าวกระแส / Viral", "ดราม่า|ไวรัล|viral|กระแส|ชาวเน็ต|ทัวร์ลง|โซเชียล|แอร์โฮสเตส|ถกใจคนค้น|นักแสดง|netflix|เอเจนซีคนจีน|นักมวย|เกาเหลา|พ่อเลี้ยงเดี่ยว"],
  // Names and words common in titles the rules above leave unknown.
  [
    "ข่าวการเมือง",
    "วิโรจน์|เท้ง|ณัฐพงษ์|ธรรมนัส|ทักษิณ|แพทองธาร|อุ๊งอิ๊ง|พิธา|ประยุทธ์|ประวิตร|สุชาติ ชมกลิ่น|วราวุธ|บรรหาร|เสรีพิศุทธ์|รักชนก|พริษฐ์|ไอติม|จตุพร|สาทิตย์|อนุดิษฐ์|ศิโรตม์|ซื้อเสียง|บัตรเสีย|บัตรดี|กาบัตร|ไอโอ|สีน้ำเงิน|ค่ายส้ม|พรรคส้ม|ส้มปูด|เสื้อแดง|ประชาชนสีอะไร|ผู้นำ|ยุติธรรม|ประเทศไทย|บ้านเมือง",
  ],
  ["ข่าวกระแส / Viral", "ทราย สก๊อต|ทราย สมุทร|ทราย สก็อต|ภิรมย์ภักดี|เอเจนซี|เอเจนซี่|อินฟลูเอนเซอร์|อินฟลูฯ|ครีเอเตอร์|ดารา|นักร้อง|ลาจอ|หมาแก่|ดรามา|แบน|boycott|บอยคอต|ทิน โชคกมลกิจ|ไวรัล"],
  ["การเงิน / ธุรกิจ", "PT-พันธุ์ไทย|ปั๊ม PT|แฟรนไชส์|ค่าครองชีพ|เศรษฐกิจ"],
];

const COMPILED = TOPIC_RULES.map(([topic, words]) => [topic, new RegExp(words, "i")] as const);

/** The rule and word that decide a text's Topic Type, or null when none matches. */
export function matchTopic(text: string): { topic: string; word: string } | null {
  for (const [topic, re] of COMPILED) {
    const m = text.match(re);
    if (m) return { topic, word: m[0] };
  }
  return null;
}

/**
 * Topic Type for a new post: from its title first, then the rest of its text;
 * programme "PROMO" is a channel promo.
 */
export function classifyTopic(title: string, text = "", program = ""): string {
  if (program.trim().toUpperCase() === "PROMO") return PROMO_TOPIC;
  return (matchTopic(title) || (text && text !== title ? matchTopic(text) : null))?.topic || UNKNOWN_TOPIC;
}
