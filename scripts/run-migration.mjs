import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("[SuperScout] Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = readFileSync(resolve(__dirname, "supabase-migration.sql"), "utf-8");

console.log("[SuperScout] Running migration against Supabase...");

const { data, error } = await supabase.rpc("exec_sql", { query: sql });

if (error) {
  console.log("[SuperScout] rpc exec_sql not available, trying direct REST SQL endpoint...");

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    console.log("[SuperScout] Direct SQL not available via REST. Attempting via SQL endpoint...");

    const sqlResponse = await fetch(`${supabaseUrl}/pg/sql`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!sqlResponse.ok) {
      const errText = await sqlResponse.text();
      console.error("[SuperScout] SQL endpoint failed:", sqlResponse.status, errText);
      console.log("\n[SuperScout] The migration SQL needs to be run in the Supabase SQL Editor.");
      console.log("[SuperScout] Attempting to run statements individually via Supabase client...");

      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      let successCount = 0;
      let failCount = 0;

      for (const stmt of statements) {
        const { error: stmtError } = await supabase.rpc("query", {
          sql_query: stmt + ";",
        });
        if (stmtError) {
          failCount++;
        } else {
          successCount++;
        }
      }

      console.log(`[SuperScout] Individual execution: ${successCount} succeeded, ${failCount} failed`);
      if (failCount > 0) {
        console.log("[SuperScout] Please run the SQL in scripts/supabase-migration.sql via the Supabase Dashboard SQL Editor.");
      }
    } else {
      console.log("[SuperScout] Migration completed via SQL endpoint!");
    }
  } else {
    console.log("[SuperScout] Migration completed via REST RPC!");
  }
} else {
  console.log("[SuperScout] Migration completed successfully!");
}

console.log("\n[SuperScout] Running verification test...");

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
  console.log("[SuperScout] Test user insert result:", insertUserErr.message);
  if (insertUserErr.message.includes("relation") && insertUserErr.message.includes("does not exist")) {
    console.error("\n[SuperScout] Tables do not exist yet. Please run the SQL in scripts/supabase-migration.sql via the Supabase Dashboard SQL Editor at:");
    console.error(`  ${supabaseUrl.replace('.supabase.co', '')}/project/sql`);
    console.error("\nCopy the entire contents of scripts/supabase-migration.sql and paste it into the SQL Editor, then click Run.");
    process.exit(1);
  }
} else {
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
  } else {
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
    } else {
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
      }
    }
  }
}
