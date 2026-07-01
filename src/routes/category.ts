import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth.ts";
import { listCategories } from "../handlers/category.ts";

const router: IRouter = Router();

router.get("/categories", requireAuth, listCategories);

export default router;