import { Router, type Request, type Response } from "express";

const router = Router();

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

router.get("/fpl/bootstrap-static", async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${FPL_BASE_URL}/bootstrap-static/`);

    if (!response.ok) {
      res.status(response.status).json({ error: "FPL API returned an error" });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    req.log.error({ err: error }, "Failed to fetch FPL data");
    res.status(502).json({ error: "Failed to reach FPL servers" });
  }
});

export default router;
