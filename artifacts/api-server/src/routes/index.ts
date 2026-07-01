import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scopesRouter from "./scopes";
import targetsRouter from "./targets";
import scansRouter from "./scans";
import findingsRouter from "./findings";
import auditRouter from "./audit";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scopesRouter);
router.use(targetsRouter);
router.use(scansRouter);
router.use(findingsRouter);
router.use(auditRouter);
router.use(reportsRouter);
router.use(dashboardRouter);

export default router;
