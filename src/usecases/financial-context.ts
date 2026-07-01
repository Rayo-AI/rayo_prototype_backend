import { BudgetUseCase } from "./budget";
import { TransactionUseCase } from "./transaction";
import { CategoryUseCase } from "./category";

function formatCurrency(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export async function buildFinancialContext(
  userId: number
) {
  const now = new Date();

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  const [budgetResult, transactionResult] =
    await Promise.all([
      BudgetUseCase.getBudget(userId),
      TransactionUseCase.getTransactions(userId, {}),
    ]);

  const categories = await CategoryUseCase.listForUser(userId);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const budgets = budgetResult.rows ?? [];
  const allTransactions =
    transactionResult.rows ?? [];

  const monthTransactions =
    allTransactions.filter((t) => {
      const date = new Date(t.date);

      return date >= start && date <= end;
    });

  const monthlyIncome = monthTransactions
    .filter((t) => t.type === "income")
    .reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

  const monthlyExpenses = monthTransactions
    .filter((t) => t.type === "expense")
    .reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

  const netSavings =
    monthlyIncome - monthlyExpenses;

  const categoryTotals =
    monthTransactions.reduce(
      (acc: Record<string, number>, t) => {
        if (t.type !== "expense") {
          return acc;
        }

        const category = categoryById.get(t.categoryId)?.name || "Other";

        acc[category] =
          (acc[category] ?? 0) +
          Number(t.amount);

        return acc;
      },
      {}
    );

  const spendingByCategory = Object.entries(
    categoryTotals
  )
    .map(([category, amount]) => ({
      category,
      amount,

      percentOfExpenses:
        monthlyExpenses > 0
          ? Number(
              (
                (amount / monthlyExpenses) *
                100
              ).toFixed(1)
            )
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const totalBudgetLimit = budgets.reduce(
    (sum, b) => {
      return sum + Number(b.monthlyLimit);
    },
    0
  );

  const budgetUsedPercent =
    totalBudgetLimit > 0
      ? Number(
          (
            (monthlyExpenses /
              totalBudgetLimit) *
            100
          ).toFixed(1)
        )
      : null;

  const recentTransactions =
    [...monthTransactions]
      .sort(
        (a, b) =>
          new Date(b.date).getTime() -
          new Date(a.date).getTime()
      )
      .slice(0, 10)
      .map((t) => ({
        type: t.type,
        amount: Number(t.amount),
        category: categoryById.get(t.categoryId)?.name || "Other",
        description:
          t.description ?? "",
        date: t.date,
      }));

  const formattedContext = `
CURRENT MONTH SUMMARY

Income:
${formatCurrency(monthlyIncome)}

Expenses:
${formatCurrency(monthlyExpenses)}

Net Savings:
${formatCurrency(netSavings)}

${
  totalBudgetLimit > 0
    ? `Budget Usage:
${budgetUsedPercent}% used of ${formatCurrency(
        totalBudgetLimit
      )}`
    : "No budget set"
}

TOP SPENDING CATEGORIES:
${
  spendingByCategory.length > 0
    ? spendingByCategory
        .slice(0, 5)
        .map(
          (c) =>
            `- ${c.category}: ${formatCurrency(
              c.amount
            )} (${c.percentOfExpenses}%)`
        )
        .join("\n")
    : "No spending categories yet"
}

BUDGETS:
${
  budgets.length > 0
    ? budgets
        .map(
          (b) =>
            `- ${categoryById.get(b.categoryId)?.name || "Other"}: ${formatCurrency(
              Number(b.monthlyLimit)
            )}${
              b.rollover
                ? " (rollover enabled)"
                : ""
            }`
        )
        .join("\n")
    : "No budgets set"
}

RECENT TRANSACTIONS:
${
  recentTransactions.length > 0
    ? recentTransactions
        .map(
          (t) =>
            `- ${
              t.type === "expense"
                ? "-"
                : "+"
            } ${formatCurrency(
              t.amount
            )} | ${t.category}${
              t.description
                ? ` | ${t.description}`
                : ""
            } | ${new Date(
              t.date
            ).toLocaleDateString("en-NG")}`
        )
        .join("\n")
    : "No recent transactions"
}
`;

  return {
    summary: {
      monthlyIncome,
      monthlyExpenses,
      netSavings,
      totalBudgetLimit:
        totalBudgetLimit || null,
      budgetUsedPercent,
    },

    budgets: budgets.map((b) => ({
      category: categoryById.get(b.categoryId)?.name || "Other",
      limit: Number(b.monthlyLimit),
      rollover: b.rollover,
    })),

    spendingByCategory,

    recentTransactions,

    formattedContext,
  };
}