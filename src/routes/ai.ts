import { Router, type IRouter } from "express";
import { db, transactionsTable, budgetsTable } from "../../db/index.ts";
import { AskAiBody, GetAiInsightsResponse, AskAiResponse } from "../../validation/index.ts";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.ts";

const router: IRouter = Router(); 

function getCurrentMonthRange() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

async function generateInsights(userId: number) {
  const { start, end } = getCurrentMonthRange();

  const categorySpend = await db
    .select({
      category: transactionsTable.category,
      amount: sql<string>`sum(${transactionsTable.amount})`,
    })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "expense"), gte(transactionsTable.date, start), lte(transactionsTable.date, end)))
    .groupBy(transactionsTable.category);

  const [totalExpenseResult] = await db
    .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "expense"), gte(transactionsTable.date, start), lte(transactionsTable.date, end)));

  const [budget] = await db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId));

  const totalExpenses = parseFloat(totalExpenseResult?.total ?? "0");
  const budgetLimit = budget ? parseFloat(budget.monthlyLimit) : null;
  const insights: Array<{ id: string; type: "warning" | "suggestion" | "alert" | "positive"; message: string; detail?: string }> = [];

  categorySpend.forEach(row => {
    const amount = parseFloat(row.amount);
    const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;

    if (row.category.toLowerCase().includes("food") && pct > 30) {
      insights.push({
        id: `food-warning-${Date.now()}`,
        type: "warning",
        message: "Food spending is high this month",
        detail: `Food accounts for ${pct.toFixed(0)}% of your monthly expenses. Consider meal planning to reduce costs.`,
      });
    }

    const subKeywords = ["subscription", "netflix", "spotify", "amazon", "streaming", "hulu", "disney"];
    if (subKeywords.some(k => row.category.toLowerCase().includes(k) || row.category.toLowerCase() === "subscriptions")) {
      insights.push({
        id: `subscription-suggestion-${Date.now()}`,
        type: "suggestion",
        message: "Review your subscriptions",
        detail: `You spent ₦${amount.toLocaleString()} on subscriptions. Audit unused services to save money.`,
      });
    }
  });

  if (budgetLimit && totalExpenses > 0) {
    const usagePercent = (totalExpenses / budgetLimit) * 100;
    if (usagePercent >= 90) {
      insights.push({
        id: `budget-alert-${Date.now()}`,
        type: "alert",
        message: "Budget almost exhausted",
        detail: `You have used ${usagePercent.toFixed(0)}% of your monthly budget. Only ₦${(budgetLimit - totalExpenses).toLocaleString()} remaining.`,
      });
    } else if (usagePercent >= 75) {
      insights.push({
        id: `budget-warning-${Date.now()}`,
        type: "warning",
        message: "Budget usage is getting high",
        detail: `You have used ${usagePercent.toFixed(0)}% of your monthly budget with days remaining.`,
      });
    } else if (usagePercent < 50) {
      const potentialSavings = budgetLimit - totalExpenses;
      insights.push({
        id: `savings-positive-${Date.now()}`,
        type: "positive",
        message: "Great budget control this month",
        detail: `You can potentially save ₦${potentialSavings.toLocaleString()} by staying on track.`,
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      id: "default-tip",
      type: "suggestion",
      message: "Track consistently to get better insights",
      detail: "Add your daily expenses to receive personalized spending insights and savings tips.",
    });
  }

  return insights;
}

router.get("/ai/insights", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const insights = await generateInsights(userId);
  res.json(GetAiInsightsResponse.parse(insights));
});

router.post("/ai/ask", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const parsed = AskAiBody.safeParse(req.body);

  if (!parsed.success) {
    sendValidationError(res, parsed.error!);
    return;
  }

  const question = parsed.data.question.toLowerCase();
  const insights = await generateInsights(userId);

  let answer = "";

  if (question.includes("save") || question.includes("saving")) {
    answer = "To save more, track your expenses daily and categorize them. Look for subscriptions you no longer use and cut back on non-essential spending. Even small daily savings compound significantly over time.";
  } else if (question.includes("budget")) {
    answer = "Setting a monthly budget is key. Aim to allocate 50% to needs, 30% to wants, and 20% to savings — the classic 50/30/20 rule. Review your budget progress weekly.";
  } else if (question.includes("expense") || question.includes("spend")) {
    answer = "Review your spending by category to identify areas to cut back. Food, entertainment, and subscriptions are often the biggest opportunities. Try the 24-hour rule before non-essential purchases.";
  } else if (question.includes("invest")) {
    answer = "Before investing, ensure you have an emergency fund covering 3-6 months of expenses. Then consider starting with low-cost index funds. The earlier you start, the more compound growth works for you.";
  } else if (question.includes("debt")) {
    answer = "Focus on high-interest debt first (avalanche method) or the smallest debt for motivation (snowball method). Avoid adding new debt while paying off existing ones.";
  } else {
    answer = "I'm your Rayo AI financial assistant. I can help you understand your spending patterns, suggest ways to save, and provide personalized financial tips based on your data. What would you like to know?";
  }

  res.json(AskAiResponse.parse({ answer, insights }));
});

export default router;
