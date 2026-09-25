import { db, ADMIN_WRITE_TOKEN } from "../lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

async function syncRevenue() {
  const jsonPath = path.resolve("./public/youtube-revenue.json");
  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(raw);

  console.log("Syncing", data.monthly.length, "months to Firestore...");

  await setDoc(doc(db, "revenueData", "meta"), {
    adminToken: ADMIN_WRITE_TOKEN,
    generatedAt: data.generatedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await setDoc(doc(db, "revenueData", "monthly"), {
    adminToken: ADMIN_WRITE_TOKEN,
    monthly: data.monthly,
    updatedAt: new Date().toISOString(),
  });

  console.log("✅ Successfully overwritten Firestore with clean 2026 data!");
  process.exit(0);
}

syncRevenue().catch((err) => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
