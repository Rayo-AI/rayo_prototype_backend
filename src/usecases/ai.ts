import { TransactionUseCase } from "./transaction";
import { BudgetUseCase } from "./budget";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ENV from "../../db/env";

const genAI = new GoogleGenerativeAI(ENV.GEMINI.API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const SYSTEM_PROMPT = `You are Rayo, a sharp and witty personal finance bestie for Nigerian Gen Z. 
You're not a boring financial advisor — you're that one friend who actually has their money together and keeps it 100 with you.

Your vibe:
- Talk like a Nigerian Gen Z — use Pidgin, slang, and casual language naturally (not forced)
- Mix English and Pidgin the way they naturally flow e.g "Omo, your food spending don too much this month sha"
- Use expressions like: omo, sha, abeg, wahala, sapa, no cap, e don do, on God, wetin, na, dey, soft life, ginger, e go better, how far
- Do not overuse those phrases
- Be hype when they do well — celebrate wins like a real friend would
- Be honest when things aren't going well but keep it encouraging
- Keep it short, punchy and real — no long grammar
- Use ₦ for all money values
- Never make up numbers — only use what's in their actual data
- Reference their real transactions and spending when giving advice

## ROAST MODE
If the user asks you to roast them, go off — but make it funny, not mean.
- Drag their spending habits with love using their actual data
- Think "bestie who's tired of your nonsense" energy, not bully energy
- Use their real numbers to make it sting e.g "You spent ₦15,000 on shawarma this month and you're asking me why you're broke? Omo."
- Keep it light — the goal is laughs and self-awareness, not shame
- End the roast with one genuine tip so they leave with something useful
- Never roast things outside their finances — only their spending habits

Example roast tone:
✓ "Abeg who sent you? You spent ₦8,000 on snacks in 2 weeks — that's not a habit, that's a lifestyle and sapa is taking notes 😭"
✓ "Your subscriptions are paying other people's salaries at this point no cap 💀"
✓ "You set a ₦50,000 food budget and spent ₦49,200 — you were ONE shawarma away from disgrace 😅"

Example non-roast tone:
❌ "Your food expenditure this month has exceeded recommended limits"
✓ "Omo, food don chop 40% of your budget this month 😭 abeg make we talk"

❌ "Great job staying within budget"  
✓ "On God you're winning this month 🔥 sapa no fit catch you like this"

Always end insights or answers with something that gingers them to keep going — like a real friend would.`;

async function buildFinancialContext(userId: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [budgetResult, transactionResult, totalExpenses, totalIncome] = await Promise.all([
    BudgetUseCase.getBudget(userId),
    TransactionUseCase.getTransactions(userId, {}),
    TransactionUseCase.getAllTimeExpenses(userId),
    TransactionUseCase.getAllTimeIncome(userId),
  ]);

  const budgets = budgetResult.rows ?? [];
  const allTransactions = transactionResult.rows ?? [];

  const monthTransactions = allTransactions.filter(t => {
    const date = new Date(t.date);
    return date >= start && date <= end;
  });

  const categoryTotals = monthTransactions.reduce((acc: Record<string, number>, t) => {
    if (t.type !== "expense") return acc;
    acc[t.category] = (acc[t.category] ?? 0) + parseFloat(t.amount);
    return acc;
  }, {});

  const totalBudgetLimit = budgets.reduce((sum, b) => sum + parseFloat(b.monthlyLimit), 0);

  return {
    summary: {
      monthlyIncome: totalIncome,
      monthlyExpenses: totalExpenses,
      totalBudgetLimit: totalBudgetLimit || null,
      budgetUsedPercent: totalBudgetLimit
        ? ((totalExpenses / totalBudgetLimit) * 100).toFixed(1)
        : null,
      netSavings: totalIncome - totalExpenses,
    },
    spendingByCategory: Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount,
      percentOfExpenses: totalExpenses > 0
        ? ((amount / totalExpenses) * 100).toFixed(1)
        : "0",
    })),
    budgets: budgets.map(b => ({
      category: b.category,
      limit: parseFloat(b.monthlyLimit),
      rollover: b.rollover,
    })),
    recentTransactions: allTransactions.slice(0, 10).map(t => ({
      type: t.type,
      amount: parseFloat(t.amount),
      category: t.category,
      description: t.description ?? "",
      date: t.date,
    })),
  };
}

export class AiUseCase {
  static async generateInsights(userId: number) {
    const context = await buildFinancialContext(userId);
    const { summary, spendingByCategory, budgets } = context;

    const prompt = `Based on this user's financial data, generate 3-5 insights in your Nigerian Gen Z bestie voice.

    Financial Summary:
    - Monthly Income: ₦${summary.monthlyIncome.toLocaleString()}
    - Monthly Expenses: ₦${summary.monthlyExpenses.toLocaleString()}
    - Net Savings: ₦${summary.netSavings.toLocaleString()}
    ${summary.totalBudgetLimit ? `- Budget Used: ${summary.budgetUsedPercent}% of ₦${summary.totalBudgetLimit.toLocaleString()}` : "- No budget set yet"}

    Spending by Category:
    ${spendingByCategory.map(c => `- ${c.category}: ₦${c.amount.toLocaleString()} (${c.percentOfExpenses}%)`).join("\n")}

    Budget Categories:
    ${budgets.map(b => `- ${b.category}: ₦${b.limit.toLocaleString()} limit${b.rollover ? " (envelope)" : ""}`).join("\n")}

    Rules:
    - Write like you're texting your Gen Z Nigerian bestie
    - Be real, be hype, be honest
    - Mix Pidgin and English naturally
    - Use emojis sparingly but effectively
    - Keep each insight punchy — no long grammar

    Return ONLY a JSON array, no extra text:
    [{ "id": "string", "type": "warning"|"suggestion"|"alert"|"positive", "message": "short punchy title", "detail": "the real talk detail in Gen Z Nigerian voice" }]`;;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
    });

    const text = result.response?.text() ?? "[]";

    try {
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean) as Array<{
        id: string;
        type: "warning" | "suggestion" | "alert" | "positive";
        message: string;
        detail?: string;
      }>;
    } catch {
      return [{
        id: "default-tip",
        type: "suggestion" as const,
        message: "Omo, start tracking first 👀",
        detail: "Add your transactions daily so Rayo fit give you the real gist about your money. No data, no insights — simple.",
      }];
    }
  }

  static async askQuestion(userId: number, question: string) {
  const context = await buildFinancialContext(userId);
  const isRoastMode = /roast|drag|come for me|tear me|blast me/i.test(question);

  const contextSummary = `
Current Month Financial Data:
- Income: ₦${context.summary.monthlyIncome.toLocaleString()}
- Expenses: ₦${context.summary.monthlyExpenses.toLocaleString()}
- Net Savings: ₦${context.summary.netSavings.toLocaleString()}
${context.summary.totalBudgetLimit ? `- Budget: ${context.summary.budgetUsedPercent}% used of ₦${context.summary.totalBudgetLimit.toLocaleString()}` : "- No budget set"}

Top Spending Categories:
${context.spendingByCategory.slice(0, 5).map(c => `- ${c.category}: ₦${c.amount.toLocaleString()} (${c.percentOfExpenses}%)`).join("\n")}

Recent Transactions:
${context.recentTransactions.map(t => `- ${t.type === "expense" ? "-" : "+"} ₦${t.amount.toLocaleString()} | ${t.category}${t.description ? ` | ${t.description}` : ""} | ${t.date}`).join("\n")}

${isRoastMode ? "⚠️ The user has explicitly asked to be roasted. Activate ROAST MODE — go off on their spending with love and humour using the data above. End with one real tip." : ""}`;

  const result = await model.generateContent({
    contents: [
      { role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\n${contextSummary}\n\nUser question: ${question}` }] },
    ],
    generationConfig: { maxOutputTokens: 512 },
  });

  return result.response?.text() ?? "I couldn't process your question. Please try again.";
}
}