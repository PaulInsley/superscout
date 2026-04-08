import { Router, type Request, type Response } from "express";

const router = Router();

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

async function proxyFplRequest(
  req: Request,
  res: Response,
  fplPath: string
): Promise<void> {
  try {
    const response = await fetch(`${FPL_BASE_URL}${fplPath}`);

    if (!response.ok) {
      res.status(response.status).json({ error: "FPL API returned an error" });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    req.log.error({ err: error }, `Failed to fetch FPL data: ${fplPath}`);
    res.status(502).json({ error: "Failed to reach FPL servers" });
  }
}

router.get("/fpl/bootstrap-static", (req: Request, res: Response) => {
  proxyFplRequest(req, res, "/bootstrap-static/");
});

router.get("/fpl/entry/:managerId", (req: Request, res: Response) => {
  const { managerId } = req.params;
  proxyFplRequest(req, res, `/entry/${managerId}/`);
});

router.get(
  "/fpl/entry/:managerId/event/:event/picks",
  (req: Request, res: Response) => {
    const { managerId, event } = req.params;
    proxyFplRequest(req, res, `/entry/${managerId}/event/${event}/picks/`);
  }
);

router.get(
  "/fpl/entry/:managerId/transfers",
  (req: Request, res: Response) => {
    const { managerId } = req.params;
    proxyFplRequest(req, res, `/entry/${managerId}/transfers/`);
  }
);

export default router;
