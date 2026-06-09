import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth.ts";
import { createTransaction, deleteMultipleTransactions, deleteTransaction, listTransactions, updateTransaction } from "../handlers/transactions.ts";
import { transactionLimiter } from "../lib/rateLimiter.ts";

const router: IRouter = Router();

router.use(requireAuth);
router.use(transactionLimiter);

router.get("/transactions", listTransactions);

router.post("/transactions", createTransaction);

router.delete("/transactions/:id", deleteTransaction);

router.patch("/transactions/:id", updateTransaction);

router.delete("/transactions", deleteMultipleTransactions);

export default router;
