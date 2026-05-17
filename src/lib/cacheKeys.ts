/**
 * Cache key constants for organizing and managing cache keys
 * Pattern: resource:identifier:variant
 */

export const CACHE_KEYS = {
  // Dashboard
  dashboard: (userId: number) => `dashboard:summary:${userId}`,
  dashboardMonth: (userId: number, month: string) => `dashboard:month:${userId}:${month}`,

  // Transactions
  transactions: (userId: number) => `transactions:list:${userId}`,
  transactionsMonth: (userId: number, month: string) => `transactions:month:${userId}:${month}`,
  monthlyIncome: (userId: number, month: string) => `transactions:income:${userId}:${month}`,
  monthlyExpenses: (userId: number, month: string) => `transactions:expenses:${userId}:${month}`,
  transactionsByCategory: (userId: number, month: string) => `transactions:category:${userId}:${month}`,
  allTimeIncome: (userId: number) => `transactions:income:all:${userId}`,
  allTimeExpenses: (userId: number) => `transactions:expenses:all:${userId}`,

  // Budgets
  budgets: (userId: number) => `budgets:list:${userId}`,
  budgetMonth: (userId: number, month: string) => `budgets:month:${userId}:${month}`,

  // Savings
  savingsGoals: (userId: number) => `savings:goals:${userId}`,
  savingsGoal: (goalId: number) => `savings:goal:${goalId}`,

  // User
  userProfile: (userId: number) => `user:profile:${userId}`,

  // Patterns for invalidation
  userPattern: (userId: number) => `*:${userId}:*`,
  transactionsPattern: (userId: number) => `transactions:*:${userId}:*`,
  budgetsPattern: (userId: number) => `budgets:*:${userId}:*`,
};

export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 5 * 60, // 5 minutes
  LONG: 30 * 60, // 30 minutes
  VERY_LONG: 2 * 60 * 60, // 2 hours
};
