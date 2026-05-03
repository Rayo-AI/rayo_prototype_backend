import { TransactionRepository } from "../repository/transactions";

export class TransactionUseCase {
  static async getMonthlyIncome(userId: number, start: Date, end: Date) {
    const incomeResult = await TransactionRepository.getMonthlyIncome(userId, start, end);
    return incomeResult;
  }

  static async getAllTimeIncome(userId: number) {
    const incomeResult = await TransactionRepository.getAllTimeIncome(userId);
    return incomeResult;
  }

  static async getExpenseByCategory(userId: number, start: Date, end: Date) {
    const expenseByCategory = await TransactionRepository.getExpenseByCategory(userId, start, end);
    return expenseByCategory;
  }

  static async getMonthlyExpenses(userId: number, start: Date, end: Date) {
    const expenseResult = await TransactionRepository.getMonthlyExpenses(userId, start, end);
    return expenseResult;
  }

  static async getAllTimeExpenses(userId: number) {
    const expenseResult = await TransactionRepository.getAllTimeExpenses(userId);
    return expenseResult;
  }

  static async getTransactionsByCategory(userId: number, start: Date, end: Date) {
    const transactions = await TransactionRepository.getTransactionsByCategory(userId, start, end);
    return transactions;
  }

  // usecases/transaction.ts
static async getTransactions(
  userId: number,
  filters: {
    category?: string;
    type?: string;
    startDate?: Date;    
    endDate?: Date;     
    limit?: number;
    orderBy?: "date" | "amount";
    description?: string;  
    amount?: number;      
  } = {}
) {
  return await TransactionRepository.getTransactions(userId, filters);
}

  static async getTransactionByUserId(userId: number) {
    const transaction = await TransactionRepository.getTransactionsByUserId(userId);
    return transaction;
  }

  static async createTransaction(userId: number, data: {
    type: "income" | "expense",
    amount: string,
    category: string,
    description?: string,
    date: string | Date,
  }) {
    const transaction = await TransactionRepository.createTransaction(userId, data);
    return transaction;
  }

  static async deleteTransaction(userId: number, transactionId: number) {
    const deleted = await TransactionRepository.deleteTransaction(userId, transactionId);
    return deleted;
  }

  static async deleteMultipleTransactions(userId: number, transactionIds: number[]) {
    const deleted = await TransactionRepository.deleteMultipleTransactions(userId, transactionIds);
    return deleted;
  }

  static async updateTransaction(userId: number, transactionId: number, data: {
    type?: "income" | "expense",
    amount?: string,
    category?: string,
    description?: string,
    date?: string | Date,
  }) {
    const updated = await TransactionRepository.updateTransaction(userId, transactionId, data);
    return updated;
  }

  static async getSpentByCategory(userId: number, category: string, start: string, end: string) {
    const spentAmount = await TransactionRepository.getSpentByCategory(userId, category, start, end);
    return spentAmount;
  }
}