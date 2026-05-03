import { Router, type IRouter } from "express";
import { db, transactionsTable } from "../../db/index.ts";
import {
  CreateTransactionBody,
  ListTransactionsQueryParams,
  DeleteTransactionParams,
  ListTransactionsResponse,
} from "../../validation/index.ts";
import { eq, and, gte, lte, SQL } from "drizzle-orm";
import { requireAuth } from "../lib/auth.ts";
import { createTransaction, deleteMultipleTransactions, deleteTransaction, listTransactions, updateTransaction } from "../handlers/transactions.ts";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/transactions", listTransactions);

router.post("/transactions", createTransaction);

router.delete("/transactions/:id", deleteTransaction);

router.put("/transactions/:id", updateTransaction);

router.delete("/transactions", deleteMultipleTransactions);

export default router;
