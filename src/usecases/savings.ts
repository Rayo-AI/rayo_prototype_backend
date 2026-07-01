import { SavingsRepository } from "../repository/savings";

export class SavingsUseCase {
  static async createSavingsGoal(
    userId: number,
    data: {
      name: string;
      categoryId: number;
      goalType?: "PERSONAL" | "GROUP" | "AJO";
      targetAmount: number;
      deadline: string;
    }
  ) {
    return SavingsRepository.createSavingsGoal(userId, data);
  }

  static async getSavingsGoals(userId: number, filters: {
    name?: string;
    deadlineBefore?: string;
    deadlineAfter?: string;
    limit?: number;
    page?: number;
  } = {}) {
    return SavingsRepository.getSavingsGoals(userId, filters);
  }

  static async updateSavingsGoal(userId: number, id: number, updates: Record<string, string | number>) {
    return SavingsRepository.updateSavingsGoal(userId, id, updates);
  }

  static async deleteSavingsGoal(userId: number, id: number) {
    return SavingsRepository.deleteSavingsGoal(userId, id);
  }

  static async findByCategoryId(userId: number, categoryId: number) {
    return SavingsRepository.findByCategoryId(userId, categoryId);
  }

  static async adjustCurrentAmount(userId: number, id: number, delta: number) {
    return SavingsRepository.adjustCurrentAmount(userId, id, delta);
  }
}