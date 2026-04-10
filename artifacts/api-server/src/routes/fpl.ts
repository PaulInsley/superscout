import { Router, type Request, type Response } from "express";
import { getCached, getStale, setCache, cacheKey, TTL, setLiveMatchActive, isLiveMatchActive } from "../lib/fplCache";
import { fetchFromFpl } from "../lib/fplRateLimiter";

const router = Router();

function isValidManagerId(id: string): boolean {
  return /^\d+$/.test(id);
}

function isValidEvent(event: string): boolean {
  if (!/^\d+$/.test(event)) return false;
  const n = parseInt(event, 10);
  return n >= 1 && n <= 50;
}

async function cachedFplRequest<T>(
  req: Request,
  res: Response,
  fplPath: string,
  key: string,
  ttl: number,
): Promise<void> {
  const cached = getCached<T>(key);
  if (cached) {
    res.set("X-Cache", "HIT");
    res.set("X-Cache-Age", String(Math.round((Date.now() - cached.fetchedAt) / 1000)));
    res.json(cached.data);
    return;
  }

  try {
    const data = await fetchFromFpl<T>(fplPath);
    setCache(key, data, ttl);

    checkForLiveMatches(key, data);

    res.set("X-Cache", "MISS");
    res.json(data);
  } catch (error) {
    const stale = getStale<T>(key);
    if (stale) {
      req.log.warn({ key, err: error }, "Serving stale cache after FPL API failure");
      const ageMs = Date.now() - stale.fetchedAt;
      res.set("X-Cache", "STALE");
      res.set("X-Cache-Age", String(Math.round(ageMs / 1000)));
      res.json(stale.data);
      return;
    }

    req.log.error({ err: error }, `Failed to fetch FPL data: ${fplPath}`);
    res.status(502).json({ error: "Failed to reach FPL servers" });
  }
}

function checkForLiveMatches(key: string, data: unknown): void {
  if (!key.includes("fixtures")) return;
  try {
    const fixtures = data as Array<{ started?: boolean; finished?: boolean }>;
    if (Array.isArray(fixtures)) {
      const hasLive = fixtures.some((f) => f.started === true && f.finished === false);
      setLiveMatchActive(hasLive);
    }
  } catch {
    // ignore
  }
}

router.get("/fpl/bootstrap-static", (req: Request, res: Response) => {
  const key = cacheKey("bootstrap-static");
  cachedFplRequest(req, res, "/bootstrap-static/", key, TTL.STATIC);
});

router.get("/fpl/entry/:managerId", (req: Request, res: Response) => {
  const managerId = String(req.params.managerId);
  if (!isValidManagerId(managerId)) {
    res.status(400).json({ error: "Invalid manager ID" });
    return;
  }
  const key = cacheKey("entry", managerId);
  cachedFplRequest(req, res, `/entry/${managerId}/`, key, TTL.USER);
});

router.get(
  "/fpl/entry/:managerId/event/:event/picks",
  (req: Request, res: Response) => {
    const managerId = String(req.params.managerId);
    const event = String(req.params.event);
    if (!isValidManagerId(managerId)) {
      res.status(400).json({ error: "Invalid manager ID" });
      return;
    }
    if (!isValidEvent(event)) {
      res.status(400).json({ error: "Invalid gameweek number" });
      return;
    }
    const key = cacheKey("picks", managerId, event);
    cachedFplRequest(req, res, `/entry/${managerId}/event/${event}/picks/`, key, TTL.USER);
  }
);

router.get(
  "/fpl/entry/:managerId/transfers",
  (req: Request, res: Response) => {
    const managerId = String(req.params.managerId);
    if (!isValidManagerId(managerId)) {
      res.status(400).json({ error: "Invalid manager ID" });
      return;
    }
    const key = cacheKey("transfers", managerId);
    cachedFplRequest(req, res, `/entry/${managerId}/transfers/`, key, TTL.USER);
  }
);

router.get(
  "/fpl/entry/:managerId/history",
  (req: Request, res: Response) => {
    const managerId = String(req.params.managerId);
    if (!isValidManagerId(managerId)) {
      res.status(400).json({ error: "Invalid manager ID" });
      return;
    }
    const key = cacheKey("history", managerId);
    cachedFplRequest(req, res, `/entry/${managerId}/history/`, key, TTL.USER);
  }
);

router.get("/fpl/search", async (req: Request, res: Response) => {
  const q = String(req.query.q ?? "").trim();
  if (!q || q.length < 2) {
    res.json({ results: [] });
    return;
  }

  const numericId = Number(q);
  if (!isNaN(numericId) && numericId > 0 && /^\d+$/.test(q)) {
    try {
      const entry = await fetchFromFpl<{
        id: number;
        name: string;
        player_first_name: string;
        player_last_name: string;
        summary_overall_rank: number | null;
        summary_overall_points: number | null;
      }>(`/entry/${numericId}/`);

      res.json({
        results: [{
          manager_id: entry.id,
          team_name: entry.name,
          manager_name: `${entry.player_first_name} ${entry.player_last_name}`,
          rank: entry.summary_overall_rank ?? 0,
          total_points: entry.summary_overall_points ?? 0,
        }],
      });
      return;
    } catch {
      res.json({ results: [] });
      return;
    }
  }

  const leagueId = String(req.query.league ?? "").trim();
  if (leagueId && /^\d+$/.test(leagueId)) {
    try {
      const pages = [1, 2];
      const allResults: Array<{
        manager_id: number;
        team_name: string;
        manager_name: string;
        rank: number;
        total_points: number;
      }> = [];

      for (const page of pages) {
        const data = await fetchFromFpl<{
          standings: {
            has_next: boolean;
            results: Array<{
              entry: number;
              entry_name: string;
              player_name: string;
              rank: number;
              total: number;
            }>;
          };
        }>(`/leagues-classic/${leagueId}/standings/?page_standings=${page}`);

        const matched = (data.standings?.results ?? []).filter((r) => {
          const lq = q.toLowerCase();
          return r.entry_name.toLowerCase().includes(lq)
            || r.player_name.toLowerCase().includes(lq);
        });

        for (const r of matched) {
          allResults.push({
            manager_id: r.entry,
            team_name: r.entry_name,
            manager_name: r.player_name,
            rank: r.rank,
            total_points: r.total,
          });
        }

        if (!data.standings?.has_next || allResults.length >= 20) break;
      }

      res.json({ results: allResults.slice(0, 20) });
      return;
    } catch (error) {
      req.log.error({ err: error, query: q, leagueId }, "FPL league search failed");
    }
  }

  res.json({ results: [] });
});

router.get("/fpl/fixtures", (req: Request, res: Response) => {
  const key = cacheKey("fixtures");
  cachedFplRequest(req, res, "/fixtures/", key, TTL.STATIC);
});

router.get("/fpl/event/:event/live", (req: Request, res: Response) => {
  const event = String(req.params.event);
  if (!isValidEvent(event)) {
    res.status(400).json({ error: "Invalid gameweek number" });
    return;
  }
  const key = cacheKey("live", event);
  const ttl = isLiveMatchActive() ? TTL.SEMI_LIVE_ACTIVE : TTL.SEMI_LIVE;
  cachedFplRequest(req, res, `/event/${event}/live/`, key, ttl);
});

export default router;
