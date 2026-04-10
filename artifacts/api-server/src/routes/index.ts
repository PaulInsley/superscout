import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fplRouter from "./fpl";
import captainRouter from "./captain";
import transferRouter from "./transfer";
import decisionLogRouter from "./decisionLog";
import processDecisionsRouter from "./processDecisions";
import squadCardRouter from "./squadCard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fplRouter);
router.use(captainRouter);
router.use(transferRouter);
router.use(decisionLogRouter);
router.use(processDecisionsRouter);
router.use(squadCardRouter);

export default router;
