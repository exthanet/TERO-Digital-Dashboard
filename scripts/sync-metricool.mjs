#!/usr/bin/env node
/**
 * CLI script to fetch posts and metrics from Metricool API
 * and synchronize with public/master-data.json.
 *
 * Usage:
 *   node scripts/sync-metricool.mjs --test
 *   node scripts/sync-metricool.mjs --days=7
 *   node scripts/sync-metricool.mjs --from=2026-08-01 --to=2026-08-31
 *   node scripts/sync-metricool.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import {
  MetricoolClient,
  mergeMetricoolIntoMaster,
} from "../lib/integrations/metricool.ts";

// Helper to load .env or .env.local without external packages
function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const content = fs.readFileSync(fullPath, "utf8");
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) return;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      });
    } catch {
      // ignore
    }
  }
}

loadEnv();

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    test: false,
    dryRun: false,
    help: false,
    days: 7,
    from: "",
    to: "",
    output: "public/master-data.json",
  };

  for (const arg of args) {
    if (arg === "--test") options.test = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("--days=")) options.days = Number(arg.split("=")[1]) || 7;
    else if (arg.startsWith("--from=")) options.from = arg.split("=")[1];
    else if (arg.startsWith("--to=")) options.to = arg.split("=")[1];
    else if (arg.startsWith("--output=")) options.output = arg.split("=")[1];
  }

  return options;
}

function formatDateIso(d) {
  return d.toISOString().slice(0, 10);
}

function printHelp() {
  console.log(`
Metricool API Sync Tool
=======================
Fetch Facebook, Instagram, and TikTok analytics directly from Metricool API.

Options:
  --test                 Verify connection and credentials with Metricool API
  --days=N               Fetch data for the last N days (default: 7)
  --from=YYYY-MM-DD      Start date for range query
  --to=YYYY-MM-DD        End date for range query (defaults to today if --from is given)
  --dry-run              Fetch and calculate metrics without modifying files
  --output=PATH          Output file path (default: public/master-data.json)
  --help, -h             Show this help message

Environment Variables (set in .env or system):
  METRICOOL_USER_ID      Your Metricool user ID
  METRICOOL_BLOG_ID      Your Metricool blog ID
  METRICOOL_API_TOKEN    Your Metricool API token
`);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    return;
  }

  const client = new MetricoolClient();

  if (options.test) {
    console.log("🔍 Checking Metricool API credentials...");
    if (!client.isConfigured()) {
      console.error("❌ Configuration incomplete!");
      console.error(`   Missing: ${client.getMissingKeys().join(", ")}`);
      console.error("   Please set them in your .env file or environment variables.");
      process.exit(1);
    }
    console.log("   Credentials found. Testing connection to Metricool API...");
    const result = await client.testConnection();
    if (result.success) {
      console.log("✅ Connection successful!");
      console.log(`   Message: ${result.message}`);
    } else {
      console.error("❌ Connection failed!");
      console.error(`   Error: ${result.message}`);
      process.exit(1);
    }
    return;
  }

  // Determine date range
  const today = new Date();
  let toDateStr = options.to || formatDateIso(today);
  let fromDateStr = options.from;

  if (!fromDateStr) {
    const fromDate = new Date();
    fromDate.setDate(today.getDate() - options.days);
    fromDateStr = formatDateIso(fromDate);
  }

  console.log("🚀 Metricool API Sync");
  console.log(`   Date Range: ${fromDateStr} to ${toDateStr}`);
  console.log(`   Target File: ${options.output}`);
  if (options.dryRun) console.log("   Mode: DRY RUN (no files will be written)");

  if (!client.isConfigured()) {
    console.error("\n❌ Cannot sync: Metricool credentials are not configured.");
    console.error(`   Missing keys: ${client.getMissingKeys().join(", ")}`);
    console.error("   Please add them to .env:");
    console.error("   METRICOOL_USER_ID=...");
    console.error("   METRICOOL_BLOG_ID=...");
    console.error("   METRICOOL_API_TOKEN=...");
    process.exit(1);
  }

  console.log("\n📡 Fetching social posts from Metricool...");
  const { rows: incomingRows, stats } = await client.fetchAllMasterRows({
    from: fromDateStr,
    to: toDateStr,
  });

  console.log("📊 Raw posts fetched:");
  console.log(`   - Facebook: ${stats.Facebook}`);
  console.log(`   - Instagram Posts: ${stats.Instagram}`);
  console.log(`   - Instagram Reels: ${stats.InstagramReels}`);
  console.log(`   - TikTok: ${stats.TikTok}`);
  console.log(`   - Total Incoming: ${incomingRows.length}`);

  if (incomingRows.length === 0) {
    console.log("ℹ️ No posts found in this date range.");
    return;
  }

  // Load existing master file
  const targetPath = path.resolve(process.cwd(), options.output);
  let master = [];
  if (fs.existsSync(targetPath)) {
    try {
      master = JSON.parse(fs.readFileSync(targetPath, "utf8"));
      console.log(`📂 Existing master data contains: ${master.length} rows`);
    } catch (e) {
      console.warn(`⚠️ Could not parse existing ${targetPath}, starting fresh.`);
    }
  }

  const { merged, inserted, updated } = mergeMetricoolIntoMaster(master, incomingRows);

  console.log("\n📈 Sync Summary:");
  console.log(`   - Inserted new rows: ${inserted}`);
  console.log(`   - Updated existing rows: ${updated}`);
  console.log(`   - Total rows in master: ${merged.length}`);

  if (!options.dryRun) {
    fs.writeFileSync(targetPath, JSON.stringify(merged, null, 2));
    console.log(`\n💾 Saved updated data to ${options.output} successfully.`);
  } else {
    console.log("\n🔒 Dry-run mode: Changes were not written to disk.");
  }
}

main().catch((err) => {
  console.error("❌ Fatal sync error:", err);
  process.exit(1);
});
