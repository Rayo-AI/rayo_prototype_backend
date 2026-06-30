import { TransactionRepository } from "../repository/transactions";

export class TransactionUseCase {
  static async getMonthlyIncome(userId: number, start: Date, end: Date) {
    return TransactionRepository.getMonthlyIncome(userId, start, end);
  }

  static async getAllTimeIncome(userId: number) {
    return TransactionRepository.getAllTimeIncome(userId);
  }

  static async getMonthlyExpenses(userId: number, start: Date, end: Date) {
    return TransactionRepository.getMonthlyExpenses(userId, start, end);
  }

  static async getAllTimeExpenses(userId: number) {
    return TransactionRepository.getAllTimeExpenses(userId);
  }

  static async getTransactionsByCategory(userId: number, filters: { start: Date, end: Date, limit?: number, page?: number }) {
    return TransactionRepository.getTransactionsByCategory(userId, filters);
  }

  static async getTransactions(
    userId: number,
    filters: {
      categoryId?: number;
      parentSlug?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      orderBy?: "date" | "amount";
      description?: string;
      amount?: number;
      page?: number;
    } = {}
  ) {
    return TransactionRepository.getTransactions(userId, filters);
  }

  static async createTransaction(userId: number, data: {
    type: "income" | "expense";
    amount: string;
    categoryId: number;
    description?: string;
    date: string | Date;
    institution?: string;
    merchant?: string;
    bill_type?: string;
  }) {
    return TransactionRepository.createTransaction(userId, data);
  }

  static async deleteTransaction(userId: number, transactionId: number) {
    return TransactionRepository.deleteTransaction(userId, transactionId);
  }

  static async deleteMultipleTransactions(userId: number, transactionIds: number[]) {
    return TransactionRepository.deleteMultipleTransactions(userId, transactionIds);
  }

  static async updateTransaction(userId: number, transactionId: number, data: {
    type?: "income" | "expense";
    amount?: string;
    categoryId?: number;
    description?: string;
    date?: string | Date;
    institution?: string;
    merchant?: string;
  }) {
    return TransactionRepository.updateTransaction(userId, transactionId, data);
  }

  static async getSpentByParentSlug(userId: number, parentSlug: string, start: string, end: string) {
    return TransactionRepository.getSpentByParentSlug(userId, parentSlug, start, end);
  }
}