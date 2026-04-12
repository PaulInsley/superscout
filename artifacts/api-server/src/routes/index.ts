import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fplRouter from "./fpl";
import captainRouter from "./captain";
import transferRouter from "./transfer";
import decisionLogRouter from "./decisionLog";
import processDecisionsRouter from "./processDecisions";
import squadCardRouter from "./squadCard";
import preGenerateRouter from "./preGenerate";
import banterRouter from "./banter";
import notificationsRouter from "./notifications";
import streaksRouter from "./streaks";
import reportCardRouter from "./reportCard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fplRouter);
router.use(captainRouter);
router.use(transferRouter);
router.use(decisionLogRouter);
router.use(processDecisionsRouter);
router.use(squadCardRouter);
router.use(preGenerateRouter);
router.use(banterRouter);
router.use(notificationsRouter);
router.use(streaksRouter);
router.use(reportCardRouter);

export default router;
