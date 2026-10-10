// วิเคราะห์คลิป → คอมเมนต์: the words people use most in a clip's comments.
// Counting only (Intl.Segmenter cuts Thai into words); no AI, no sentiment.
// Each comment counts a word once, so one long comment cannot fill the list.
//
// Relative imports only: tests run this file directly with Node.

/** Particles, pronouns and filler that say nothing about the topic. */
const STOP = new Set(
  (
    "ครับ คับ ค่ะ คะ ค่า จ้า จ๊ะ นะ น่ะ นะคะ นะครับ ครับผม ค่ะ จ้ะ ฮะ อะ อ่ะ เนอะ หรอ เหรอ ไหม มั้ย มั๊ย ล่ะ สิ ซิ เถอะ " +
    "ที่ และ หรือ แต่ กับ ของ ใน ให้ ได้ ไป มา ว่า เป็น คือ มี ไม่ ก็ จะ แล้ว ยัง อยู่ นี้ นั้น นี่ นั่น โน่น เลย อีก ด้วย " +
    "จาก ถึง เพื่อ เพราะ ถ้า เมื่อ ตอน ซึ่ง อย่าง แบบ เขา เค้า เรา ผม ฉัน หนู คุณ มัน พวก คน กัน ทำ ทุก บาง " +
    "มาก ต่อ ข้อ ช่วง เรื่อง อัน ตัว ทาง จริง จริงๆ กว่า ขึ้น ลง ออก เข้า " +
    "อะไร ยังไง ทำไม ตรงไหน ใคร กี่ เท่าไร แค่ ก่อน หลัง ต้อง ควร อาจ คง กำลัง เคย ขอ เอา ดู รู้ ไหน เท่า " +
    "the a an and or to of in is it this that for on you i"
  ).split(/\s+/),
);

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("th", { granularity: "word" }) : null;

/** Words of a text: word-like pieces of 2+ letters, lower-case, no numbers, no stop words. */
export function wordsOf(text: string): string[] {
  const clean = String(text || "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[@#]\S+/g, " ")
    .toLowerCase();
  const pieces = segmenter ? [...segmenter.segment(clean)].filter((s) => s.isWordLike).map((s) => s.segment) : clean.split(/[^\p{L}\p{M}]+/u);
  return pieces.map((w) => w.trim()).filter((w) => w.length >= 2 && !/^\d+$/.test(w) && !/^(.)\1+$/u.test(w) && !STOP.has(w));
}

/** The most used words over the comments (each comment counts a word once); words in fewer than `min` comments are left out. */
export function topWords(comments: { id: string; text: string }[], n = 12, min = 2): { word: string; comments: number }[] {
  const seen = new Set<string>();
  const count = new Map<string, number>();
  for (const c of comments) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    for (const w of new Set(wordsOf(c.text))) count.set(w, (count.get(w) || 0) + 1);
  }
  return [...count.entries()]
    .filter(([, k]) => k >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"))
    .slice(0, n)
    .map(([word, comments]) => ({ word, comments }));
}
