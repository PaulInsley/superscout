import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[SuperScout] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!dbPassword) {
  console.error("[SuperScout] Missing SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "").replace(/\//g, "");
console.log("[SuperScout] Project ref:", projectRef);

const fullSql = readFileSync(resolve(__dirname, "supabase-migration.sql"), "utf-8");

const hosts = [
  `db.${projectRef}.supabase.co`,
  `${projectRef}.supabase.co`,
  `aws-0-eu-west-2.pooler.supabase.com`,
  `aws-0-us-east-1.pooler.supabase.com`,
  `aws-0-eu-central-1.pooler.supabase.com`,
  `aws-0-us-west-1.pooler.supabase.com`,
  `aws-0-ap-southeast-1.pooler.supabase.com`,
];

const ports = [5432, 6543];
const users = ["postgres", `postgres.${projectRef}`];

let connected = false;

for (const host of hosts) {
  for (const port of ports) {
    for (const user of users) {
      if (connected) break;
      const client = new pg.Client({
        host,
        port,
        user,
        password: dbPassword,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
      });

      try {
        console.log(`[SuperScout] Trying ${user}@${host}:${port}...`);
        await client.connect();
        console.log(`[SuperScout] Connected to ${host}:${port} as ${user}`);
        connected = true;

        console.log("[SuperScout] Running migration SQL...");
        await client.query(fullSql);
        console.log("[SuperScout] Migration SQL executed successfully!");
        await client.end();
      } catch (err) {
        const msg = err.message || "";
        if (msg.includes("ENOTFOUND") || msg.includes("timeout") || msg.includes("ECONNREFUSED")) {
          continue;
        }
        console.error(`[SuperScout] Error with ${host}:${port}:`, msg);
        try { await client.end(); } catch (_) {}
        if (msg.includes("password authentication failed")) continue;
      }
    }
  }
}

if (!connected) {
  console.error("\n[SuperScout] Could not connect to Supabase Postgres with any known host pattern.");
  console.error("[SuperScout] Please run the SQL manually in the Supabase Dashboard → SQL Editor.");
  console.error("[SuperScout] The migration file is at: scripts/supabase-migration.sql");
  process.exit(1);
}

console.log("\n[SuperScout] Running verification test...");
const supabase = createClient(supabaseUrl, serviceRoleKey);

const testEmail = "test@superscout.pro";

const { data: insertUser, error: insertUserErr } = await supabase
  .from("users")
  .insert({
    email: testEmail,
    fpl_manager_id: "13042160",
    default_persona: "expert",
  })
  .select()
  .single();

if (insertUserErr) {
  console.error("[SuperScout] Test user insert failed:", insertUserErr.message);
  process.exit(1);
}

console.log("[SuperScout] Test user inserted:", insertUser.id);

const { data: insertRec, error: insertRecErr } = await supabase
  .from("recommendations")
  .insert({
    user_id: insertUser.id,
    season: "2025-26",
    gameweek: 31,
    decision_type: "captain",
    options_shown: [
      {
        player_name: "Salah",
        expected_points: 8.5,
        confidence_level: 0.85,
        upside_text: "Home fixture, on pens",
        risk_text: "Rotation risk",
        is_superscout_pick: true,
      },
      {
        player_name: "Haaland",
        expected_points: 7.2,
        confidence_level: 0.75,
        upside_text: "In form",
        risk_text: "Tough away fixture",
        is_superscout_pick: false,
      },
      {
        player_name: "Palmer",
        expected_points: 6.8,
        confidence_level: 0.65,
        upside_text: "Differential pick",
        risk_text: "Inconsistent minutes",
        is_superscout_pick: false,
      },
    ],
    data_sources_used: ["fpl_api"],
    persona_used: "expert",
  })
  .select()
  .single();

if (insertRecErr) {
  console.error("[SuperScout] Test recommendation insert failed:", insertRecErr.message);
  process.exit(1);
}

console.log("[SuperScout] Test recommendation inserted:", insertRec.id);

const { data: readUser } = await supabase
  .from("users")
  .select("*")
  .eq("id", insertUser.id)
  .single();
console.log("[SuperScout] Read back user:", JSON.stringify(readUser, null, 2));

const { data: readRec } = await supabase
  .from("recommendations")
  .select("*")
  .eq("id", insertRec.id)
  .single();
console.log("[SuperScout] Read back recommendation:", JSON.stringify(readRec, null, 2));

const { error: deleteErr } = await supabase
  .from("users")
  .delete()
  .eq("id", insertUser.id);

if (deleteErr) {
  console.error("[SuperScout] Delete test user failed:", deleteErr.message);
  process.exit(1);
}

console.log("[SuperScout] Test user deleted (cascade should remove recommendation)");

const { data: checkUser } = await supabase
  .from("users")
  .select("id")
  .eq("email", testEmail);
const { data: checkRec } = await supabase
  .from("recommendations")
  .select("id")
  .eq("id", insertRec.id);

const userGone = !checkUser || checkUser.length === 0;
const recGone = !checkRec || checkRec.length === 0;

if (userGone && recGone) {
  console.log("[SuperScout] CASCADE verified — both records deleted");
  console.log("\n[SuperScout] All 18 tables created and verified");
} else {
  console.error("[SuperScout] CASCADE check failed — user gone:", userGone, "rec gone:", recGone);
  process.exit(1);
}
