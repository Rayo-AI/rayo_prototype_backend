import { BudgetRepository } from "../repository/budget";

export class BudgetUseCase {
  static async getBudget(userId: number) {
    const budget = await BudgetRepository.getAllBudgets(userId);
    return budget;
  }

  static async createBudget(userId: number, category: string, monthlyLimit: number) {
    const budget = await BudgetRepository.createBudget(userId, category, monthlyLimit);
    return budget;
  }

  static async updateBudget(userId: number, category: string, monthlyLimit: number) {
    const budget = await BudgetRepository.updateBudget(userId, category, monthlyLimit);
    return budget;
  }

  static async getBudgetByCategory(userId: number, category: string) {
    const budget = await BudgetRepository.getBudgetByCategory(userId, category);
    return budget;
  }

  static async updateBalance(userId: number, category: string, balance: number) {
    return BudgetRepository.updateBalance(userId, category, balance);
  }

  static async resetBalancesForMonthRollover(userId: number, start: string, end: string) {
    return BudgetRepository.resetBalancesForMonthRollover(userId, start, end);
  }

  static async deleteBudget(userId: number, category: string) {
    return BudgetRepository.deleteBudget(userId, category);
  }
}