import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { getInsights, askAi } from "../handlers/ai";
import { aiLimiter } from "../lib/rateLimiter";
import { parseFormBody } from "../lib/multer.ts";

const router = Router();

router.use(requireAuth);
router.use(parseFormBody);

router.get("/ai/insights", aiLimiter, getInsights);
router.post("/ai/ask", aiLimiter, askAi);

export default router;