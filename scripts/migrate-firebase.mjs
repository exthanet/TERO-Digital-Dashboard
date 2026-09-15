import fs from "node:fs";
import path from "node:path";

const targetJsonPath = "public/master-data.json";
const PROJECT_ID = "entertainment-dashboard-733e5";
const CHUNK_SIZE = 500;

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

async function getAccessToken() {
  // 1. Check if user provided service account
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saPath && fs.existsSync(saPath)) {
    console.log("🔑 Using FIREBASE_SERVICE_ACCOUNT_JSON...");
    const { cert, getApps, initializeApp } = await import("firebase-admin/app");
    const account = JSON.parse(fs.readFileSync(saPath, "utf8"));
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(account) });
    const token = await app.options.credential.getAccessToken();
    return token.access_token;
  }

  // 2. Check Firebase CLI logged-in config
  const configstorePath = path.join(process.env.USERPROFILE || "", ".config", "configstore", "firebase-tools.json");
  if (fs.existsSync(configstorePath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configstorePath, "utf8"));
      const token = config.tokens?.access_token;
      if (token) {
        console.log(`🔑 Using Firebase CLI authenticated session (${config.user?.email || "logged-in user"})...`);
        return token;
      }
    } catch {
      // ignore
    }
  }

  throw new Error(
    "No Firebase credentials found. Please run 'firebase login' or set FIREBASE_SERVICE_ACCOUNT_JSON."
  );
}

async function uploadChunk(token, chunkIndex, chunkRows) {
  const docId = `chunk_${String(chunkIndex).padStart(3, "0")}`;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/masterData/${docId}`;

  const payload = {
    fields: {
      chunkIndex: { integerValue: String(chunkIndex) },
      rowCount: { integerValue: String(chunkRows.length) },
      updatedAt: { stringValue: new Date().toISOString() },
      rows: toFirestoreValue(chunkRows),
    },
  };

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to upload ${docId} (${res.status} ${res.statusText}): ${text}`);
  }
}

async function main() {
  console.log("🚀 Starting Firebase Firestore Migration...");
  if (!fs.existsSync(targetJsonPath)) {
    throw new Error(`Master data file not found at ${targetJsonPath}`);
  }

  const rows = JSON.parse(fs.readFileSync(targetJsonPath, "utf8"));
  console.log(`📊 Total rows in ${targetJsonPath}: ${rows.length}`);

  const token = await getAccessToken();

  const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);
  console.log(`📦 Partitioning into ${totalChunks} chunks of ${CHUNK_SIZE} rows each...`);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, rows.length);
    const chunkRows = rows.slice(start, end);

    process.stdout.write(`   Uploading chunk ${i + 1}/${totalChunks} (rows ${start + 1} - ${end})... `);
    await uploadChunk(token, i, chunkRows);
    console.log("✅");
  }

  console.log(`\n🎉 Successfully uploaded all ${rows.length} rows to Firestore 'masterData' collection!`);
}

main().catch((err) => {
  console.error("\n❌ Migration error:", err.message || err);
  process.exit(1);
});
