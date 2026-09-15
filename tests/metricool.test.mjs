import assert from "node:assert/strict";
import test from "node:test";
import {
  splitTimestamp,
  inferProgram,
  inferTopicType,
  generateFacebookId,
  transformFacebookPost,
  transformInstagramPost,
  transformTikTokPost,
  mergeMetricoolIntoMaster,
  MetricoolClient,
} from "../lib/integrations/metricool.ts";

test("splitTimestamp extracts date and time correctly", () => {
  const result = splitTimestamp("2026-08-25 14:30");
  assert.ok(result);
  assert.equal(result.iso, "2026-08-25");
  assert.equal(result.date, "25/08/2026");
  assert.equal(result.time, "14:30");
});

test("inferProgram identifies known show names", () => {
  assert.equal(inferProgram("ไฮไลต์ ถกไม่เถียง ประเด็นร้อน"), "ถกไม่เถียง");
  assert.equal(inferProgram("รายการ เงินทองของจริง วันนี้"), "เงินทองของจริง");
  assert.equal(inferProgram("คลิปสนุก kids fun channel"), "Kidsfun");
  assert.equal(inferProgram("ฟังเพลงฮิตกับ Hitzradio 95.5"), "Hitzradio");
  assert.equal(inferProgram("คลิปทั่วไปที่ไม่มีชื่อรายการ"), "ไม่ระบุ");
});

test("inferTopicType correctly categorizes topics", () => {
  assert.equal(inferTopicType("โปรโมชันพิเศษ สปอนเซอร์ลูกค้า"), "งานลูกค้า / งานขอ / Branded Content");
  assert.equal(inferTopicType("สถานการณ์ชายแดนไทย ฮุน เซน กัมพูชา"), "ข่าวไทย–กัมพูชา");
  assert.equal(inferTopicType("ตำรวจจับกุมแก๊งสแกมเมอร์คอลเซ็นเตอร์"), "ข่าวตำรวจ / อาชญากรรม / สแกมเมอร์");
  assert.equal(inferTopicType("สภาเปิดอภิปรายไม่ไว้วางใจรัฐบาล"), "ข่าวการเมือง");
  assert.equal(inferTopicType("คลิปทั่วไป"), "ไม่ระบุ");
});

test("generateFacebookId produces structured ID from URL", () => {
  const url1 = "https://www.facebook.com/terodigital/posts/123456789";
  assert.equal(generateFacebookId(url1), "FB-123456789");

  const url2 = "https://www.facebook.com/terodigital/videos/987654321/";
  assert.equal(generateFacebookId(url2), "FB-987654321");
});

test("transformFacebookPost converts raw Metricool post to master format", () => {
  const rawPost = {
    date: "2026-08-20 10:15",
    postLink: "https://www.facebook.com/terodigital/posts/555666777",
    content: "ถกไม่เถียง ตอนใหม่วันนี้\nรายละเอียดเพิ่มเติมที่ลิงก์",
    videoViews: 15200,
    reactions: 350,
    comments: 45,
    shared: 25,
    type: "video",
    reach: 22000,
    clicks: 120,
  };

  const row = transformFacebookPost(rawPost);
  assert.ok(row);
  assert.equal(row.Date, "20/08/2026");
  assert.equal(row.Publish_Time, "10:15");
  assert.equal(row.Program, "ถกไม่เถียง");
  assert.equal(row.Platform, "Facebook");
  assert.equal(row.VDO_Type, "Facebook Video");
  assert.equal(row.Views, "15200");
  assert.equal(row.Likes, "350");
  assert.equal(row.Comments, "45");
  assert.equal(row.Shares, "25");
  assert.equal(row.Engagement, "420"); // 350 + 45 + 25
  assert.equal(row.Content_ID, "FB-555666777");
});

test("transformInstagramPost converts IG post and reels", () => {
  const rawReel = {
    timestamp: "2026-08-21 18:00",
    url: "https://www.instagram.com/reel/C8xyz123/",
    id: "17901234567",
    caption: "ไฮไลต์ เงินทองของจริง ประจำสัปดาห์",
    views: 45000,
    likes: 1200,
    comments: 80,
    shares: 50,
    saved: 120,
    reach: 38000,
  };

  const reelRow = transformInstagramPost(rawReel, true);
  assert.ok(reelRow);
  assert.equal(reelRow.Date, "21/08/2026");
  assert.equal(reelRow.Program, "เงินทองของจริง");
  assert.equal(reelRow.Platform, "Instagram");
  assert.equal(reelRow.VDO_Type, "Facebook/IG Reels");
  assert.equal(reelRow.Content_ID, "IG-17901234567");
  assert.equal(reelRow.Views, "45000");
  assert.equal(reelRow.Engagement, "1450"); // 1200 + 80 + 50 + 120
});

test("transformTikTokPost converts TikTok video post", () => {
  const rawTikTok = {
    date: "2026-08-22 12:00",
    url: "https://www.tiktok.com/@terodigital/video/7391234567890",
    id: "7391234567890",
    text: "ถกไม่เถียง คลิปไวรัลสุดเดือด",
    videoViews: 85000,
    likes: 4500,
    comments: 210,
    shares: 180,
    duration: 45,
    reach: 65000,
  };

  const row = transformTikTokPost(rawTikTok);
  assert.ok(row);
  assert.equal(row.Date, "22/08/2026");
  assert.equal(row.Program, "ถกไม่เถียง");
  assert.equal(row.Platform, "TikTok");
  assert.equal(row.VDO_Type, "TikTok");
  assert.equal(row.Content_ID, "TT-7391234567890");
  assert.equal(row.Views, "85000");
  assert.equal(row.Engagement, "4890");
});

test("mergeMetricoolIntoMaster updates existing and inserts new records", () => {
  const master = [
    {
      Date: "15/08/2026",
      Program: "ถกไม่เถียง (Curated)",
      Episode_ID: "",
      Topic: "เรื่องเดิม",
      Topic_Type: "ข่าวการเมือง",
      VDO_Type: "Facebook Post",
      Platform: "Facebook",
      Channel: "-",
      Content_ID: "FB-111",
      URL: "https://www.facebook.com/terodigital/posts/111",
      Publish_Time: "09:00",
      Duration_Min: "0.00",
      Views: "500",
      Likes: "10",
      Comments: "2",
      Shares: "1",
      Engagement: "13",
      Engagement_Rate: "2.60%",
      TV_Rating_Total: "",
      "TV_Rating_15+BKK": "",
      "TV_Rating_15+URBAN": "",
      "TV_Rating_15+BKK&URBAN": "",
      "TV_Rating_15+RURAL": "",
      TV_Audience_Total: "",
      "TV_Audience_15+BKK": "",
      "TV_Audience_15+URBAN": "",
      "TV_Audience_15+BKK&URBAN": "",
      "TV_Audience_15+RURAL": "",
      Best_of_Month: "",
      Upload_Count: "1",
      Revenue: "0",
      Notes: "old",
    },
  ];

  const incoming = [
    // Update existing row (URL matches FB-111)
    {
      Date: "15/08/2026",
      Program: "ไม่ระบุ", // Should NOT overwrite "ถกไม่เถียง (Curated)"
      Episode_ID: "",
      Topic: "เรื่องเดิม",
      Topic_Type: "ไม่ระบุ", // Should NOT overwrite "ข่าวการเมือง"
      VDO_Type: "Facebook Post",
      Platform: "Facebook",
      Channel: "-",
      Content_ID: "FB-111",
      URL: "https://www.facebook.com/terodigital/posts/111",
      Publish_Time: "09:00",
      Duration_Min: "0.00",
      Views: "1500", // New views
      Likes: "50",
      Comments: "10",
      Shares: "5",
      Engagement: "65",
      Engagement_Rate: "4.33%",
      TV_Rating_Total: "",
      "TV_Rating_15+BKK": "",
      "TV_Rating_15+URBAN": "",
      "TV_Rating_15+BKK&URBAN": "",
      "TV_Rating_15+RURAL": "",
      TV_Audience_Total: "",
      "TV_Audience_15+BKK": "",
      "TV_Audience_15+URBAN": "",
      "TV_Audience_15+BKK&URBAN": "",
      "TV_Audience_15+RURAL": "",
      Best_of_Month: "",
      Upload_Count: "1",
      Revenue: "0",
      Notes: "updated",
    },
    // New row
    {
      Date: "16/08/2026",
      Program: "เงินทองของจริง",
      Episode_ID: "",
      Topic: "เรื่องใหม่",
      Topic_Type: "ข่าวการเงิน",
      VDO_Type: "Facebook Post",
      Platform: "Facebook",
      Channel: "-",
      Content_ID: "FB-222",
      URL: "https://www.facebook.com/terodigital/posts/222",
      Publish_Time: "10:00",
      Duration_Min: "0.00",
      Views: "2000",
      Likes: "80",
      Comments: "15",
      Shares: "10",
      Engagement: "105",
      Engagement_Rate: "5.25%",
      TV_Rating_Total: "",
      "TV_Rating_15+BKK": "",
      "TV_Rating_15+URBAN": "",
      "TV_Rating_15+BKK&URBAN": "",
      "TV_Rating_15+RURAL": "",
      TV_Audience_Total: "",
      "TV_Audience_15+BKK": "",
      "TV_Audience_15+URBAN": "",
      "TV_Audience_15+BKK&URBAN": "",
      "TV_Audience_15+RURAL": "",
      Best_of_Month: "",
      Upload_Count: "1",
      Revenue: "0",
      Notes: "new",
    },
  ];

  const { merged, inserted, updated } = mergeMetricoolIntoMaster(master, incoming);

  assert.equal(inserted, 1);
  assert.equal(updated, 1);
  assert.equal(merged.length, 2);

  // Check that FB-111 was updated with new views but preserved its curated program & topic type
  const updatedRow = merged[0];
  assert.equal(updatedRow.Views, "1500");
  assert.equal(updatedRow.Program, "ถกไม่เถียง (Curated)");
  assert.equal(updatedRow.Topic_Type, "ข่าวการเมือง");

  // Check new row
  const newRow = merged[1];
  assert.equal(newRow.Content_ID, "FB-222");
  assert.equal(newRow.Views, "2000");
});

test("MetricoolClient config validation", () => {
  const emptyClient = new MetricoolClient({ userId: "", blogId: "", apiToken: "" });
  assert.equal(emptyClient.isConfigured(), false);
  assert.deepEqual(emptyClient.getMissingKeys(), [
    "METRICOOL_USER_ID",
    "METRICOOL_BLOG_ID",
    "METRICOOL_API_TOKEN",
  ]);

  const configuredClient = new MetricoolClient({
    userId: "12345",
    blogId: "67890",
    apiToken: "test-token",
  });
  assert.equal(configuredClient.isConfigured(), true);
  assert.deepEqual(configuredClient.getMissingKeys(), []);
});
