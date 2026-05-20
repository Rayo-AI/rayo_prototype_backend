export const SAFE_REDIRECT =
  "I dey for your money gist only sha 😭 Ask me about your spending, savings, budget or transactions.";

export function isRoastMode(
  input: string
) {
  return /\b(roast|drag|cook me|judge me|rate my spending)\b/i.test(
    input
  );
}

export function isBlockedTopic(
  input: string
) {
  return /\b(crypto|bitcoin|forex|stock|stocks|invest|investment|trading|betting|gambling|casino|politics|relationship|dating|medical|doctor|therapy)\b/i.test(
    input
  );
}

export function isFinanceIntent(
  input: string
) {
  return /\b(budget|saving|expense|spending|transaction|money|income|debt|subscription|salary|rent|food|transport|bills|afford|sapa)\b/i.test(
    input
  );
}