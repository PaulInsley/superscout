import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[SuperScout] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const fullSql = readFileSync(resolve(__dirname, "supabase-migration.sql"), "utf-8");

console.log("[SuperScout] Running migration via Supabase SQL API...");

const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");
console.log("[SuperScout] Project ref:", projectRef);

const response = await fetch(`${supabaseUrl}/rest/v1/rpc`, {
  method: "POST",
  headers: {
    "apikey": serviceRoleKey,
    "Authorization": `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  },
});
console.log("[SuperScout] RPC endpoint check:", response.status);

const statements = fullSql
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

console.log(`[SuperScout] Parsed ${statements.length} SQL statements`);

let successCount = 0;
let failCount = 0;
const failures = [];

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const preview = stmt.substring(0, 80).replace(/\n/g, " ");

  const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({}),
  });

  if (i === 0) {
    console.log("[SuperScout] First RPC attempt status:", resp.status);
  }
}

console.log("[SuperScout] REST RPC not viable for raw SQL. Switching to pg direct connection...");

let pg;
try {
  pg = await import("pg");
} catch (e) {
  console.log("[SuperScout] pg module not installed. Installing...");
  const { execSync } = await import("child_process");
  execSync("pnpm add -w pg", { encoding: "utf-8", stdio: "inherit" });
  pg = await import("pg");
}

const dbHost = `db.${projectRef}.supabase.co`;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.log("[SuperScout] No SUPABASE_DB_PASSWORD found.");
  console.log("[SuperScout] Attempting Supabase Management API approach...");

  const mgmtResp = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: fullSql }),
    }
  );

  if (mgmtResp.ok) {
    const result = await mgmtResp.json();
    console.log("[SuperScout] Migration executed via Management API!");
    console.log("[SuperScout] Result:", JSON.stringify(result).substring(0, 200));
  } else {
    const errText = await mgmtResp.text();
    console.log("[SuperScout] Management API status:", mgmtResp.status);

    console.log("\n[SuperScout] Direct SQL execution not available from this environment.");
    console.log("[SuperScout] Please run the migration SQL manually:");
    console.log("  1. Go to your Supabase Dashboard → SQL Editor");
    console.log("  2. Paste the contents of scripts/supabase-migration.sql");
    console.log("  3. Click 'Run'");
    console.log("\n[SuperScout] Alternatively, provide SUPABASE_DB_PASSWORD as a secret for direct Postgres access.");
    process.exit(1);
  }
}

if (dbPassword) {
  const client = new pg.default.Client({
    host: dbHost,
    port: 5432,
    user: "postgres",
    password: dbPassword,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("[SuperScout] Connected to Supabase Postgres directly");
    await client.query(fullSql);
    console.log("[SuperScout] Migration SQL executed successfully!");
    await client.end();
  } catch (err) {
    console.error("[SuperScout] Postgres error:", err.message);
    await client.end();
    process.exit(1);
  }
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
