import { SavingsRepository } from "../repository/savings";

export class SavingsUseCase {
  static async createSavingsGoal(userId: number, name: string, targetAmount: number, deadline: string) {
    const savings = await SavingsRepository.createSavingsGoal(userId, name, targetAmount, deadline);

    return savings;
  }

  static async getSavingsGoals(userId: number, filters: {
    name?: string;
    deadlineBefore?: string;
    deadlineAfter?: string;
    limit?: number;
    page?: number;
    } = {}
  ) {
    return await SavingsRepository.getSavingsGoals(userId, filters);
  }

  static async updateSavingsGoal(userId: number, id: number, updates: Record<string, string>) {
    return await SavingsRepository.updateSavingsGoal(userId, id, updates);
  }

  static async deleteSavingsGoal(userId: number, id: number) {
    return await SavingsRepository.deleteSavingsGoal(userId, id);
  }
}