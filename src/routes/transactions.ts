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

const router: IRouter = Router();

router.get("/transactions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const query = ListTransactionsQueryParams.safeParse(req.query);

  const conditions: SQL[] = [eq(transactionsTable.userId, userId)];

  if (query.success) {
    if (query.data.category) {
      conditions.push(eq(transactionsTable.category, query.data.category));
    }
    if (query.data.type) {
      conditions.push(eq(transactionsTable.type, query.data.type as "income" | "expense"));
    }
    if (query.data.startDate) {
      conditions.push(gte(transactionsTable.date, query.data.startDate));
    }
    if (query.data.endDate) {
      conditions.push(lte(transactionsTable.date, query.data.endDate));
    }
  }

  const rows = await db
    .select()
    .from(transactionsTable)
    .where(and(...conditions))
    .orderBy(transactionsTable.date);

  const transactions = rows.map(t => ({
    id: t.id,
    userId: t.userId,
    type: t.type,
    amount: parseFloat(t.amount),
    category: t.category,
    description: t.description,
    date: t.date,
    createdAt: t.createdAt.toISOString(),
  }));

  res.json(ListTransactionsResponse.parse(transactions));
});

router.post("/transactions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const parsed = CreateTransactionBody.safeParse(req.body);

  if (!parsed.success) {
    sendValidationError(res, parsed.error!);
    return;
  }

  const [row] = await db
    .insert(transactionsTable)
    .values({
      userId,
      type: parsed.data.type as "income" | "expense",
      amount: String(parsed.data.amount),
      category: parsed.data.category,
      description: parsed.data.description,
      date: parsed.data.date,
    })
    .returning();

  res.status(201).json({
    id: row.id,
    userId: row.userId,
    type: row.type,
    amount: parseFloat(row.amount),
    category: row.category,
    description: row.description,
    date: row.date,
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteTransactionParams.safeParse({ id: parseInt(raw, 10) });

  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(transactionsTable)
    .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
