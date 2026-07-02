import { BudgetRepository } from "../repository/budget";

export class BudgetUseCase {
  static async getBudget(userId: number, filters: {
    categoryId?: number;
    limit?: number;
    page?: number;
  } = {}) {
    return BudgetRepository.getAllBudgets(userId, filters);
  }

  static async createBudget(userId: number, name: string, categoryId: number, monthlyLimit: number, rollover = true) {
    return BudgetRepository.createBudget(userId, name, categoryId, monthlyLimit, rollover);
  }

  static async updateBudget(userId: number, categoryId: number, updates: { monthlyLimit?: number, name?: string }) {
    return BudgetRepository.updateBudget(userId, categoryId, updates);
  }

  static async getBudgetByCategoryId(userId: number, categoryId: number) {
    return BudgetRepository.getBudgetByCategoryId(userId, categoryId);
  }

  static async updateBalance(userId: number, categoryId: number, balance: number) {
    return BudgetRepository.updateBalance(userId, categoryId, balance);
  }

  static async resetBalancesForMonthRollover(userId: number, start: string, end: string) {
    return BudgetRepository.resetBalancesForMonthRollover(userId, start, end);
  }

  static async deleteBudget(userId: number, categoryId: number) {
    return BudgetRepository.deleteBudget(userId, categoryId);
  }
}