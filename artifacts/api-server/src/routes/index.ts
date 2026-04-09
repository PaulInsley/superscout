import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fplRouter from "./fpl";
import captainRouter from "./captain";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fplRouter);
router.use(captainRouter);

export default router;
