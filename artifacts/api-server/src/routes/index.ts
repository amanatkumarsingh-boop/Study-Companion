import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import studyRouter from "./study";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(studyRouter);

export default router;
