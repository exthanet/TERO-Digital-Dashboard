# วิธีคำนวณตัวเลขใน Dashboard (ฉบับเทคนิค)

คู่มือสำหรับทีม dev / admin: ทุกตัวเลขบนหน้าเว็บคำนวณอย่างไร มาจาก field ไหน และอยู่ที่ไฟล์ไหน
ฉบับภาษาง่ายสำหรับผู้ใช้อยู่ในหน้า **คู่มือ & FAQ** (`lib/help/content.ts`, หัวข้อ “วิธีคำนวณ: …”)
เอกสารนี้อธิบายตามโค้ดปัจจุบัน ถ้าแก้สูตรให้แก้ทั้งสองที่ · ไม่มีตัวเลขจริงหรือรหัสช่องในเอกสารนี้

คำย่อ: L = likes, C = comments, S = shares, median = ค่ากลาง (มัธยฐาน)

---

## 1. ข้อมูลเข้าระบบ (sync)

ตัวเลขจาก API เขียนตามจริง ไม่ปัด ไม่กันค่าลด (`raw()` เก็บทศนิยม 3 ตำแหน่ง)

| แพลตฟอร์ม | Views | Likes / Comments / Shares | เวลาดู | ไฟล์ |
|---|---|---|---|---|
| Facebook Post | `impressions` (Meta “Views”), ไม่มีใช้ `videoViews` | reactions / comments / shares | – | `lib/integrations/metricoolSync.ts:262-278` |
| Facebook Reels | `blueReelsPlayCount` | `postVideoReactions` / `postVideoSocialActions` / 0 | `postVideoAvgTimeWatchedSeconds` | `:279-292` |
| Instagram / Reels | `views` (ไม่ใช่ impressions) | ตาม API | Reels: `averageWatchTime`, `durationSeconds`, `reelsSkipRate` | `:293-306` |
| TikTok | `viewCount` | `likeCount` / `commentCount` / `shareCount` | ไม่มี | `:307-318` |
| YouTube | Data API ทับ Metricool (views, likes, comments) | shares จาก Metricool → YouTube Analytics ทับ | Analytics `averageViewDuration` | `youtubeData.ts:184-212`, `youtubeAnalytics.ts:183-200` |

- คอลัมน์คำนวณตอน sync: `Engagement = L + C + S`, `Engagement_Rate = Engagement ÷ Views` (`metricoolSync.ts:336,363-364`)
- การอัปเดตแถวเดิม: จับคู่ด้วย `Platform|postId` (`lib/dashboard/postKey.ts`) เขียนทับเฉพาะคอลัมน์ตัวเลข · Program, Topic, Topic_Type, VDO_Type, Revenue, Notes และคอลัมน์ TV ไม่ถูกเขียนทับ · Hashtags / Publish_Time เติมเฉพาะช่องว่าง (`metricoolSync.ts:402-461`)
- โพสต์ซ้ำใน masterData: เก็บ 1 แถวต่อ `Platform|postId` (แถววิวสูงสุด) และยืมคอลัมน์ที่ทีมกรอกจากแถวที่ทิ้ง (`:529-561`)
- YouTube ที่มีเฉพาะใน Data API: Shares = 0 จนกว่า Analytics จะเติม · VDO type = Shorts ถ้า ≤ 180 วินาที, LIVE หรือ Video Episode (`youtubeData.ts:131-151`)

### TV
- `TV_Rating_*` เก็บตามไฟล์ (`lib/integrations/tvSheet.ts:193-206`)
- `TV_Audience_Total`: One31 ใช้คอลัมน์จำนวนผู้ชมถ้ามี ไม่มีใช้ rating × 700,000 · GMM25 และผู้ชมรายโซน = rating × 700,000 เสมอ (`AUDIENCE_PER_POINT`, `:54`)

### growthDaily (วิวที่เพิ่มรายวัน)
- ต่อโพสต์ที่ตัวเลขเปลี่ยน: ค่าใหม่ − ค่าเดิม ของ views / likes / comments / shares (ไม่เปลี่ยนไม่บันทึก) · โพสต์ใหม่นับจาก 0 · โพสต์ที่โผล่ช้ากว่า 1 วันไม่นับ (`lib/integrations/growthWriter.ts:20-40`)
- บันทึกเป็นวันที่ sync − 1 · sync ซ้ำในวันเดียวกันบวกเพิ่ม (`lib/dashboard/growth.ts:34-43`)
- เริ่มเก็บ 2026-10-01

---

## 2. Normalize และนิยาม “1 แถว” (`lib/dashboard/normalize.ts`)

- ตัวเลข: ตัดจุลภาค, มี “%” หาร 100, อ่านไม่ได้ = 0 (`:3-9`)
- วันที่: `YYYY-MM-DD`, Excel serial หรือ `DD/MM/YYYY` (ปี พ.ศ. ลบ 543) · ไม่มีวันที่ทิ้งแถว (`:43-85,195`)
- `engagement` = คอลัมน์ Engagement หรือ L+C+S · `engagementRate` = คอลัมน์ หรือ engagement ÷ views (`:136-137,168`)
- `gmmRating` / `gmmAudience` อ่านจาก Notes (`GMM Rating:` / `GMM Audience:`) (`:142-143`)
- VDO type: มี “short” → YouTube Shorts · Video Episode / full → YouTube Full Episode · reel → Facebook/IG Reels · live → Live (`:87-99`)
- Topic type ว่าง / “ไม่ระบุ” / ขึ้นต้น “#” → “ไม่ระบุประเภท” (`:101-121`)
- **TV**: แถวที่เป็น TV หรือมี rating รวมเป็น 1 แถวต่อ `วันที่_รายการ` · rating One31 จากแถวที่ไม่ใช่ GMM · GMM จากแถวช่อง GMM หรือ Notes (`:194-242`)
- **Digital**: ไม่ dedupe ซ้ำในหน้าเว็บ (อาศัย sync) · ไม่รวมข้ามแพลตฟอร์ม

### “1 คอนเทนต์” ข้ามแพลตฟอร์ม (`lib/dashboard/contentGroups.ts:39-63`)
- รายการเดียวกัน + ชื่อเดียวกันหลังตัด hashtag (ตัวพิมพ์เล็ก) + โพสต์ห่างจากโพสต์แรกไม่เกิน 3 วัน (`SIBLING_DAYS`)
- `lead` = โพสต์วิวสูงสุด · `date` = โพสต์แรก · `views` = ผลรวม

### ชุดแถวตามตัวกรอง (`hooks/useDashboard.ts`)
| ชุด | ใช้ตัวกรอง |
|---|---|
| `filtered` (249-262) | ทุกตัว + วันที่ |
| `executiveRows` (263-275) | ทุกตัว ยกเว้น platform |
| `growthRows` (277-289) | ไม่ใช่ TV, ไม่กรองวันที่ |
| `rankingRows` (949-961) | ไม่กรองวันที่ |
| `platformReportRows` (963-974) | ไม่กรอง platform / วันที่ |
| `programReportRows` (976-987) | ไม่กรองรายการ / วันที่ |

ค้นหา: คำคั่นจุลภาค เจอคำใดก็นับ ใน title + program + channel + hashtags ไม่สนตัวพิมพ์ ตัด # นำหน้า (`lib/dashboard/search.ts:9-20`)

---

## 3. ช่วงวันที่และการเปรียบเทียบ (`lib/dashboard/dates.ts`)

- preset แบบ “ล่าสุด” นับถึง **เมื่อวาน (เวลาไทย)** · ค่าเริ่มต้น 28 วัน
- ช่วงเทียบ: PREVIOUS = จำนวนวันเท่ากันก่อนหน้า · YEAR_AGO = วันเดียวกันปีก่อน (29 ก.พ. → 28 ก.พ.) · CUSTOM · NONE (`:98-111`)
- % บนการ์ด KPI = (ช่วงนี้ − ช่วงเทียบ) ÷ ช่วงเทียบ แสดงเมื่อช่วงเทียบ > 0 · ช่วงเทียบไม่มีแถวเลย → ซ่อนทุก % (`useDashboard.ts:1002-1021`) · |ค่า| < 0.05% แสดง ■ (`components/dashboard/shared/Growth.tsx:11-18`)

---

## 4. การ์ด KPI (`hooks/useDashboard.ts:393-483`, `KpiSummary.tsx`)

| การ์ด | สูตร |
|---|---|
| ยอดวิวรวม (TV + Digital) | Σ views digital + Σ(audienceTotal + gmmAudience) |
| ยอดวิวรวม (Digital Only) | Σ views · เฉลี่ย/วัน = ÷ จำนวน **วันที่มีโพสต์** (ไม่ใช่วันปฏิทิน) |
| TV Audience รวม | Σ(audienceTotal + gmmAudience) · ตอน = เทป One31 (rating > 0) + เทป GMM25 (gmm > 0) · เฉลี่ย/ตอน = ผู้ชม ÷ ตอน |
| TV Rating (Average) | mean ratingTotal ของ rating > 0 / mean gmmRating ของ gmm > 0 |
| Engagement รวม | Σ engagement |
| Engagement Rate | Σ engagement ของแถวที่ views > 0 ÷ Σ views |
| Total Upload | Σ uploadCount (ค่าเริ่ม 1) |

- โหมด TV (กรอง platform = TV): การ์ดวิวกลายเป็นผู้ชมทีวี
- Executive Insights: โพสต์วิวสูงสุด · แพลตฟอร์มเด่น = วิวแพลตฟอร์ม ÷ รวม (รวมผู้ชมทีวีเมื่อ ALL) · ER รายแถวสูงสุดของโพสต์ที่วิว ≥ 1,000 และ ER ≤ 100% (`:1089-1112`)

## 5. กราฟและตารางหน้าภาพรวม

- Digital vs TV / VDO type / pie: ใช้ `executiveRows` · ≤ 31 วันแสดงรายวัน มากกว่านั้นรายเดือน · VDO top 6 + อื่นๆ · pie top 8 (`useDashboard.ts:291-392`)
- Top 10 ประเด็น: เรียงตามวิว · ER = engagementRate รายแถว (`:605-615`)
- Topic Type donut: top 10 · % = วิวประเภท ÷ วิวรวม (รวมกันอาจไม่ถึง 100%) (`:525-535`)
- Topic trend: 30 วันถึงวันล่าสุดของ digital เทียบ 30 วันก่อน (`:1031-1064`)
- `bestFormat`: ต้องมี ≥ 3 โพสต์ · score = วิวเฉลี่ย × (1 + 5 × ER) (`lib/dashboard/analytics.ts:24-51`)
- Compare table: TV ก่อน · โพสต์ digital เข้ากลุ่ม TV รายการเดียวกัน หรือกลุ่มที่ชื่อคล้าย ≥ 0.24 (trigram Dice) · คอลัมน์ facebook = Facebook + Instagram (`useDashboard.ts:724-840`)

## 6. TV

- Rating chart / 4 โซน: mean ของแถว rating > 0 (`useDashboard.ts:628-680`) · กราฟแท่งซ้อน ความสูงรวมไม่มีความหมาย
- แผนที่โซน: “สัดส่วน” = rating โซน ÷ ผลรวม 4 โซน (โซนซ้อนกัน) (`components/dashboard/TvRatingChoropleth.tsx:149-156`)
- ผู้ชมรายวัน: One31 = Σ audienceTotal, GMM25 = Σ gmmAudience (`useDashboard.ts:681-703`)
- Rating ตามรายการ/ช่อง: rating = mean, audience = Σ, ตอน = นับแถว (`:704-722`)
- คู่แข่ง (`lib/dashboard/competitors.ts`, `TvCompetitorChart.tsx`): rating เราจาก `rankingRows` · rating คู่แข่งนอก 0–30 ไม่นับและเตือน · trend = mean ต่อวัน/เดือน ปัด 3 ตำแหน่ง · ranking = mean ทั้งช่วง · “ชนะ” = วันที่ออกพร้อมกันและเราสูงกว่า ÷ วันที่ออกพร้อมกัน
- Ranking เทป (`lib/dashboard/ranking.ts:218-227`): เรียงตาม rating One31 · % จากเฉลี่ย 4 สัปดาห์ = (rating − mean 28 วันก่อน) ÷ mean

## 7. Ranking ดี / แย่ (`lib/dashboard/ranking.ts`)

- ไม่รวม TV · ช่วง = ช่วงรายงาน / วันเดียว / สัปดาห์ จันทร์–อาทิตย์
- ค่าปกติ: ช่วง ≤ 31 วัน = median วิว (> 0) ใน **30 วันก่อนช่วง** · ยาวกว่า = median ภายในช่วง (`:17,82-88`)
- กลุ่มเทียบ: platform + VDO type (≥ 3 คลิป) → ทั้ง platform (≥ 3) → ไม่มี · index = views ÷ ค่าปกติ
- รวมทุกแพลตฟอร์ม: เทียบกับคอนเทนต์ที่ลงจำนวนแพลตฟอร์มเท่ากัน (`:159-215`)
- ฝั่งแย่ไม่นับ: โพสต์ ≥ วันล่าสุด − 1, ที่อยู่ฝั่งดีแล้ว, วิว < 50 (`MIN_VIEWS_FOR_WORST`)
- วันล่าสุด = วันล่าสุดที่มีคลิป digital ไม่เกินวันสิ้นสุดตัวกรอง (`RankingSection.tsx:167-176`)

## 8. รายงานรายแพลตฟอร์ม (`lib/dashboard/platformReport.ts`)

- วิวรวม = Σ · โพสต์ = จำนวนแถว · วิวต่อโพสต์ = median · ER = Σ(L+C+S) ทุกแถว ÷ Σ views · Share/Comment ต่อ 1K = Σ ÷ views × 1000 (`:31-43`)
- % = (ช่วงนี้ − ก่อน) ÷ ก่อน, ไม่แสดงเมื่อก่อน ≤ 0 (`:66`)
- TV: เทป = แถว · rating One31 = mean ของ > 0 · **ผู้ชม = Σ audienceTotal (One31 เท่านั้น)** · GMM25 = mean gmm > 0 (`:54-63`)
- วัน × ชั่วโมง: median เมื่อมี ≥ 3 โพสต์ · เวลา “00:00” = ไม่มีเวลา ไม่นับ · ช่วงดีสุด = top 3 (`:114-152`)
- Hashtag: ≥ 3 โพสต์ · index = median ของ tag ÷ median ของ platform · ไม่ซ่อน tag ของช่อง (`:171-202`)

## 9. รวมรายการ (`lib/dashboard/programReport.ts`)

- < 5 โพสต์และไม่มี TV → “อื่นๆ” (`:16,98-108`)
- growth = (วิว − ก่อน) ÷ ก่อน · median · ER = Σ(L+C+S) ÷ Σ views · share = วิวรายการ ÷ วิวออนไลน์รวม
- TV: rating = mean ของ > 0 · **ผู้ชม = Σ audienceTotal (One31 เท่านั้น)** (`:77`)
- รายละเอียด: top 5 โพสต์ · Topic type ≥ 3 โพสต์ เรียงตาม median · Hashtag ≥ 2 โพสต์ ไม่รวม tag ช่อง (`:121-152`)

## 10. Trending Hashtag (`lib/dashboard/trendingHashtags.ts`)

- ช่วง 7 / 30 / 90 วัน ถึง `dataLatestDate` (ไม่ใช้ตัวกรองวันที่) · ช่วงก่อน = n วันก่อนหน้า (`:22-25`)
- ซ่อน CHANNEL_TAGS และ tag ที่อยู่ในโพสต์ที่มี tag เกิน 60% (เมื่อมี ≥ 10 โพสต์) (`:30-35,84-88`)
- ≥ 2 โพสต์ · เรียงตาม Σ views · ER = (L+C+S) ÷ views · growth = (วิว − ก่อน) ÷ ก่อน (`:90-136`)
- วิว = ยอดสะสมตลอดอายุของโพสต์ในช่วง ไม่ใช่วิวที่เพิ่ม

## 11. การเติบโต (`lib/dashboard/growth.ts`, `earlySignal.ts`, `evergreen.ts`)

- วิวที่เพิ่ม = Σ gain ของ growthDaily ที่จับคู่กับแถวได้ (ไม่เกิน 92 วัน) · เฉลี่ย/วัน = ÷ วันที่มีข้อมูล · ค่าลบแสดงตามจริงพร้อมป้าย
- วิวจากคลิปเก่า = gain ของโพสต์ก่อนวันเริ่มช่วง ÷ gain รวม
- % เทียบ = (a − b) ÷ |b| แสดงเมื่อทั้งสองช่วงมีข้อมูลครบทุกวัน (`GrowthSection.tsx:132-138`)
- Early signal: วิวรอบแรก ÷ ชั่วโมงหลังโพสต์ (0.5–48 ชม.) · percentile เทียบกลุ่มรายการ + platform + VDO type · < 20 คลิปเทียบ = ข้อมูลยังน้อย · ≥ 90% เริ่มต้นแรง, ≥ 75% ดีกว่าปกติ (`earlySignal.ts:16,62-112`)
- Evergreen: อายุ ≥ 14 วัน, มีวิวเพิ่ม ≥ 80% ของวันที่มีข้อมูล, เฉลี่ย ≥ 100 วิว/วัน · แนวโน้ม = mean ครึ่งหลัง ÷ ครึ่งแรก (> 1.15 ขึ้น, < 0.85 ลง, ต้อง ≥ 4 วัน) (`evergreen.ts:11-17,77-93`)

## 12. คุณภาพคลิป (`lib/dashboard/quality.ts`)

- % ที่ดู = Avg_Watch_Sec ÷ Video_Length_Sec (เกิน 100% ได้) · ค่าแพลตฟอร์ม = ถ่วงด้วยวิว (`:13-15,48-70`)
- Reels ไม่ถูกปัดทิ้ง = ถ่วงวิวของ (1 − Skip_Rate/100) (`:72`)
- ER = Σ engagement ของแถว views > 0 ÷ Σ views (เหมือนการ์ด KPI)
- ดี / แย่: วิว ≥ 50 · index = ค่า ÷ median ของ VDO type เดียวกัน (≥ 5 คลิป) (`:111-132`)

## 13. คำแนะนำ (`lib/dashboard/advice.ts`)

ไม่รวม TV, วิว > 0 · ไม่นับคลิปที่โพสต์ ≥ วันล่าสุด − 1 · กลุ่ม = platform + VDO type · เทียบด้วย median

| กฎ | เงื่อนไข |
|---|---|
| 1 ความยาวคลิป | กลุ่มที่ median ความยาว ≤ 180 วิ · ช่วง <15, 15–30, 30–45, 45–60, 60–90, 90–180 วิ · ช่วงละ ≥ 10 คลิป อย่างน้อย 2 ช่วง · ดีสุด ÷ แย่สุด ≥ 1.3 |
| 2 IG ปัดทิ้ง | IG ที่มี skipRate และวิว ≥ 50 (≥ 10 คลิป) · คลิปที่ไม่ถูกปัด < 0.8 × median อย่างน้อย 3 คลิป |
| 3 ประเภทหัวข้อ | ประเภทละ ≥ 8 คลิป · median ประเภท ÷ median กลุ่ม ≥ 1.3 ดี, ≤ 0.7 ระวัง |
| 4 ER สูงวิวต่ำ | วิว ≥ 50 (กลุ่ม ≥ 10) · ER ≥ 1.5 × median และวิว ≤ 0.7 × median อย่างน้อย 3 คลิป |
| 5 โพสต์มากวิวลด | ทั้งสองช่วง ≥ 10 คลิป · โพสต์ +20% และ median วิว −20% |
| 6 วันในสัปดาห์ | วันละ ≥ 8 คลิป · ดีสุด ÷ แย่สุด ≥ 1.3 |
| 7 ช่วงเวลา | 05–10:59, 11–15:59, 16–20:59, 21–04:59 · ช่วงละ ≥ 8 คลิป · ≥ 1.3 |

## 14. YouTube Deep Dive (`lib/dashboard/ytDeepDive.ts`)

- ยอดตลอดอายุจาก YouTube Analytics จับคู่ด้วย video ID
- Hook (Shorts) = engagedViews ÷ views · Hold = averageViewPercentage (เก็บเป็น %) · 4 กลุ่มเทียบ median ของ Shorts ในหน้า (`:97-110`)
- Engagement ต่อ VDO type: ER = Σ(L+C+S) ÷ Σ views, ต่อ 1K วิว · ผู้ติดตามใหม่: คลิป ≥ 10,000 วิว เรียงตาม subs ÷ views × 1000
- SEO: traffic share = วิวจากแหล่ง ÷ วิวรวมของช่วง 28 / 90 วัน · ตรงกับชื่อ = สัดส่วนวิวค้นหาจากคำที่ทุกคำอยู่ในชื่อคลิป (< 30% แสดงแดง)
- Revenue: Σ estimatedRevenue (USD) · RPM = รายได้ ÷ วิว × 1000 · CPM จาก API

## 15. Monthly ACC (`lib/integrations/accMonthlyCollect.ts:49-104`, `lib/dashboard/accMonthly.ts`)

ดึงจาก YouTube Analytics API (CMS) ทีละช่อง ทีละเดือน (วันที่ 1 ถึงสิ้นเดือนหรือวันนี้)

| คอลัมน์ | API |
|---|---|
| Owned Views | metric `views` |
| YouTube Premium Views | `redViews` |
| Owned Views : Watch Page / Embedded Player / Channel Page | `views` × dimension `insightPlaybackLocationType` = `WATCH` / `EMBEDDED` / `CHANNEL` |
| Owned Views : Live / On Demand | `views` × dimension `liveOrOnDemand` = `LIVE` / `ON_DEMAND` |
| Owned Views : Ad-Enabled | ไม่มีใน API · เว้นว่าง |
| Ads revenue / Premium revenue | `estimatedAdRevenue` / `estimatedRedPartnerRevenue` (USD) |

- Watch + Embedded + Channel ไม่เท่ากับ Owned Views (ที่เหลือคือฟีด Shorts, Browse, Search, External ฯลฯ) · Live + On Demand ≈ Owned Views
- บรรทัดรายการ = query เดียวกันกรองด้วย video ID ของรายการ (Program ใน masterData หรือชื่อรายการในชื่อคลิป) (`accMonthly.ts:90-99`)
- บรรทัด TERO DIGITAL = ทั้งช่อง − บรรทัดรายการ ไม่ต่ำกว่า 0 (`accMinus`)
- Export: × อัตรา THB ของเดือน (`:106-127`)

## 16. รายได้ตามบริษัท (`lib/dashboard/revenueCompanies.ts`)

- THB = USD × อัตราของเดือนจากไฟล์ · เดือนไม่มีอัตราไม่รวมและแจ้งไว้ (`:33-52`)
- ส่วนที่ไม่อยู่ใน 2 sheet = Overall − Digital − Entertainment เมื่อมีครบ 3 sheet (`:69-93`)
- ตรวจ: EST.Revenue ต่างจากผลรวม 12 คอลัมน์ > 0.05 · Overall ≠ Digital + Entertainment > 0.05 · สองบริษัทรวมเกิน Overall > 0.05 (`:106-139`)

## 17. Topic type (`lib/dashboard/topicRules.ts`)

- PROMO → โปรโมทรายการ · เงินทองของจริง → การเงิน / ธุรกิจ (ยกเว้นเข้ากฎ Branded) · นอกนั้นกฎแรกใน `TOPIC_RULES` ที่ตรง (ดูชื่อก่อน แล้วข้อความส่วนอื่น) · ไม่ตรง = ไม่ระบุ · ค่าที่ทีมกรอกเองไม่ถูกเขียนทับ

---

## 18. จุดที่คำนวณต่างกันระหว่างหน้า (ยังไม่ได้แก้ · ตรวจเมื่อ 2026-10-07)

1. **ผู้ชมทีวี**: การ์ด KPI / กราฟภาพรวม = One31 + GMM25 · รายแพลตฟอร์ม > TV (`platformReport.ts:60`), รวมรายการ (`programReport.ts:77`), ผลค้นหา (`search.ts:57`) = One31 เท่านั้น
2. **จำนวนตอน TV**: การ์ด KPI นับแยกช่อง (1 ออกอากาศ = 2) · หน้าอื่นนับแถว
3. **ER 3 แบบ**: KPI / คุณภาพ = engagement ของแถวที่มีวิว · รายแพลตฟอร์ม / รวมรายการ / ค้นหา / Hashtag = L+C+S ทุกแถว · Top 10 / Insights = ER รายแถว
4. **Comment ต่อ 1K**: Audience Report ไม่นับแถววิว 0 (`audience.ts:32`) · รายแพลตฟอร์มนับ (`platformReport.ts:41`)
5. **เวลา 00:00 (ไม่มีเวลา)**: ตัดเฉพาะ heatmap รายแพลตฟอร์มและ Trending · Audience รายชั่วโมง, Clip detail และคำแนะนำกฎ 7 นับเป็นเที่ยงคืน (ช่วง “ดึก”)
6. **คำแนะนำกฎ 3** กรอง `"ไม่ระบุ"` (`advice.ts:181`) แต่ระบบใช้ `"ไม่ระบุประเภท"` (`normalize.ts:104`) จึงไม่ถูกตัดออก
7. **คำแนะนำกฎ 5** ช่วงนี้ตัดคลิปใหม่ แต่ช่วงก่อนไม่ตัด (`advice.ts:309-312`)
8. **วันล่าสุด**: Ranking ใช้วันล่าสุดของ digital · รายแพลตฟอร์ม / คำแนะนำ / Thumbnail / Trending ใช้ `dataLatestDate` (อาจเป็นวันของ TV)
9. **Hashtag ของช่อง** ซ่อนใน Trending และรวมรายการ แต่ไม่ซ่อนในรายแพลตฟอร์ม
10. **median ของรายการว่าง** = 0 ในคำแนะนำ / รวมรายการ / Audience แต่ = “-” ในรายแพลตฟอร์ม / Ranking / คุณภาพ / Deep Dive
11. **ข้อความไม่ตรงโค้ด**: กราฟ Rating เขียน “ยังไม่แปลง Rating × 700,000” (`PerformanceSections.tsx:204`) และ insight “โดยไม่คูณ Rating” (`useDashboard.ts:1109`) แต่ sync คูณแล้ว · หน้าการเติบโตเขียนเวลา sync ไม่ตรงกัน (`GrowthSection.tsx:173,245,349`)
12. **สัดส่วนโซน TV** หารด้วยผลรวมโซนที่ซ้อนกัน
13. **Topic donut** แสดง top 10 จึงรวมไม่ถึง 100%
14. **กฎ % เปลี่ยนแปลง** ต่างกัน: KPI ต้อง > 0 และช่วงเทียบมีแถว · การเติบโตหาร |b| และต้องครบทุกวัน · คุณภาพ / Audience หาร b เมื่อไม่เป็น 0
15. **คู่แข่ง TV** rating เราจาก `rankingRows` ที่ใช้ตัวกรอง platform อยู่ ถ้าเลือก YouTube เส้นของเราจะว่าง (`app/dashboard.tsx:395-401`)
