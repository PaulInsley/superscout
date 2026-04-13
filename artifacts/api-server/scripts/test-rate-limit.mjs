const BASE_URL = `http://localhost:${process.env["PORT"] || 8080}`;
const ENDPOINT = "/api/captain-picks";
const TOTAL_REQUESTS = 25;
const RATE_LIMIT_THRESHOLD = 20;

async function testRateLimit() {
  console.log(`=== Rate Limiter Verification ===`);
  console.log(`Endpoint: ${BASE_URL}${ENDPOINT}`);
  console.log(`Rate limit threshold: ${RATE_LIMIT_THRESHOLD} req/min`);
  console.log(`Total requests to send: ${TOTAL_REQUESTS}`);
  console.log(`Method: POST (concurrent burst to trigger rate limiter)\n`);
  console.log(`Note: Non-429 responses confirm the request passed through the`);
  console.log(`rate limiter and reached the route handler. The handler response`);
  console.log(`status itself is irrelevant to rate limit verification.\n`);

  const results = [];

  const promises = Array.from({ length: TOTAL_REQUESTS }, async (_, i) => {
    const res = await fetch(`${BASE_URL}${ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vibe: "expert",
        context: "GAMEWEEK: 1 test context for rate limit verification",
      }),
    });
    results.push({ index: i + 1, status: res.status });
  });

  await Promise.all(promises);

  results.sort((a, b) => a.index - b.index);

  let passedRateLimiter = 0;
  let rateLimitedCount = 0;

  for (const r of results) {
    let label;
    if (r.status === 429) {
      label = "BLOCKED BY RATE LIMITER (429)";
      rateLimitedCount++;
    } else {
      label = `PASSED RATE LIMITER → route handler returned ${r.status}`;
      passedRateLimiter++;
    }
    console.log(`  Request #${String(r.index).padStart(2, " ")}: ${label}`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total requests:              ${TOTAL_REQUESTS}`);
  console.log(`Passed through rate limiter: ${passedRateLimiter}`);
  console.log(`Blocked by rate limiter:     ${rateLimitedCount}`);

  const passed =
    rateLimitedCount > 0 &&
    passedRateLimiter <= RATE_LIMIT_THRESHOLD;

  if (passed) {
    console.log(`\n✓ PASS — Rate limiter correctly enforced the ${RATE_LIMIT_THRESHOLD} req/min threshold.`);
    console.log(`  ${passedRateLimiter} requests passed through; ${rateLimitedCount} were blocked with 429.`);
    process.exit(0);
  } else {
    console.log(`\n✗ FAIL — Rate limiter did not behave as expected.`);
    console.log(`  Expected at most ${RATE_LIMIT_THRESHOLD} to pass, with at least ${TOTAL_REQUESTS - RATE_LIMIT_THRESHOLD} blocked.`);
    console.log(`  Actual: ${passedRateLimiter} passed, ${rateLimitedCount} blocked.`);
    process.exit(1);
  }
}

testRateLimit().catch((err) => {
  console.error(err);
  process.exit(1);
});
