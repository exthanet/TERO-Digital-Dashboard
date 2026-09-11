import { readFile } from "node:fs/promises";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const path = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!path) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON to a service-account JSON file path.");
const account = JSON.parse(await readFile(path, "utf8"));
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(account) });
const db = getFirestore(app);
const rows = JSON.parse(await readFile("public/master-data.json", "utf8"));
for (let start = 0; start < rows.length; start += 400) {
  const batch = db.batch();
  rows.slice(start, start + 400).forEach((row, i) => batch.set(db.collection("masterData").doc(String(start + i)), row));
  await batch.commit();
  console.log(`Uploaded ${Math.min(start + 400, rows.length)}/${rows.length}`);
}
