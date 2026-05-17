/**
 * UPSTASH REDIS CACHE IMPLEMENTATION GUIDE
 * 
 * This file demonstrates how to use the Upstash Redis caching layer in your Rayo Finance backend.
 * Redis is perfect for caching frequently accessed data like dashboard summaries and monthly aggregates.
 * 
 * IMPORTANT: Upstash Redis uses REST API with these limitations:
 * - Pattern matching (KEYS) is not available
 * - FLUSHDB is not available
 * - For cache invalidation, explicitly call invalidateCache() for each key
 */

// ============================================================================
// EXAMPLE 1: Caching Dashboard Summary (High-frequency queries)
// ============================================================================

// In: src/handlers/dashboard.ts
/*
import { getCached, invalidateCache } from "../lib/cache.ts";
import { CACHE_KEYS, CACHE_TTL } from "../lib/cacheKeys.ts";

export const dashboardSummary = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;
  const { start, end } = getCurrentMonthRange();
  const monthKey = `${start}-${end}`;

  // Use caching for dashboard - cache for 5 minutes
  const summary = await getCached(
    CACHE_KEYS.dashboardMonth(userId, monthKey),
    async () => {
      const [
        incomeResult,
        expenseResult,
        allIncomeResult,
        allExpenseResult,
        budgets,
        recentRows,
      ] = await Promise.all([
        TransactionUseCase.getMonthlyIncome(userId, new Date(start), new Date(end)),
        TransactionUseCase.getMonthlyExpenses(userId, new Date(start), new Date(end)),
        TransactionUseCase.getAllTimeIncome(userId),
        TransactionUseCase.getAllTimeExpenses(userId),
        BudgetUseCase.getBudget(userId),
        TransactionUseCase.getTransactions(userId, { limit: 5, page: 1 }),
      ]);

      // ... rest of aggregation logic
      return {
        totalBalance,
        monthlyIncome,
        monthlyExpenses,
        budgetMonthlyLimit,
        budgetPercentUsed,
        recentTransactions,
      };
    },
    CACHE_TTL.MEDIUM // 5 minutes
  );

  return appResponse(res, 200, GetDashboardSummaryResponse.parse(summary), "Dashboard summary retrieved successfully");
});
*/

// ============================================================================
// EXAMPLE 2: Invalidating Cache After Creating/Updating Data
// ============================================================================

// In: src/handlers/transactions.ts
/*
import { invalidateCache } from "../lib/cache.ts";
import { CACHE_KEYS } from "../lib/cacheKeys.ts";

export const createTransaction = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;
  const transaction = await TransactionUseCase.createTransaction(userId, req.body);

  // Invalidate related caches
  // NOTE: Upstash doesn't support pattern matching, so invalidate specific keys
  const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  await Promise.all([
    invalidateCache(CACHE_KEYS.dashboard(userId)),
    invalidateCache(CACHE_KEYS.dashboardMonth(userId, monthKey)),
    invalidateCache(CACHE_KEYS.monthlyIncome(userId, monthKey)),
    invalidateCache(CACHE_KEYS.monthlyExpenses(userId, monthKey)),
    invalidateCache(CACHE_KEYS.transactions(userId)),
  ]);

  return appResponse(res, 201, transaction, "Transaction created successfully");
});
*/

// ============================================================================
// EXAMPLE 3: Caching User Profile (Long-lived data)
// ============================================================================

// In: src/repository/auth.ts (or usecase)
/*
import { getCached, invalidateCache } from "../lib/cache.ts";
import { CACHE_KEYS, CACHE_TTL } from "../lib/cacheKeys.ts";

export async function getUserProfile(userId: number) {
  return getCached(
    CACHE_KEYS.userProfile(userId),
    async () => {
      return await db.select().from(usersTable).where(eq(usersTable.id, userId));
    },
    CACHE_TTL.LONG // 30 minutes
  );
}

export async function updateUserProfile(userId: number, data: unknown) {
  // Update user
  const updated = await db.update(usersTable).set(data).where(eq(usersTable.id, userId));
  
  // Invalidate cache
  await invalidateCache(CACHE_KEYS.userProfile(userId));
  
  return updated;
}
*/

// ============================================================================
// EXAMPLE 4: Caching List Queries (Paginated data)
// ============================================================================

// In: src/usecases/transaction.ts
/*
import { getCached } from "../lib/cache.ts";
import { CACHE_KEYS, CACHE_TTL } from "../lib/cacheKeys.ts";

export class TransactionUseCase {
  static async getMonthlyIncome(userId: number, start: Date, end: Date) {
    const monthKey = start.toISOString().slice(0, 7); // YYYY-MM
    
    return getCached(
      CACHE_KEYS.monthlyIncome(userId, monthKey),
      async () => {
        return await TransactionRepository.getMonthlyIncome(userId, start, end);
      },
      CACHE_TTL.MEDIUM
    );
  }

  static async getMonthlyExpenses(userId: number, start: Date, end: Date) {
    const monthKey = start.toISOString().slice(0, 7); // YYYY-MM
    
    return getCached(
      CACHE_KEYS.monthlyExpenses(userId, monthKey),
      async () => {
        return await TransactionRepository.getMonthlyExpenses(userId, start, end);
      },
      CACHE_TTL.MEDIUM
    );
  }
}
*/

// ============================================================================
// EXAMPLE 5: Manual Cache Management (When needed)
// ============================================================================

// In: src/services/admin.ts (or similar)
/*
import { setCache, invalidateCache, clearAllCache } from "../lib/cache.ts";
import { CACHE_KEYS } from "../lib/cacheKeys.ts";

// Set cache manually
export async function prewarmCache(userId: number) {
  const profile = await fetchUserProfile(userId);
  await setCache(CACHE_KEYS.userProfile(userId), profile, CACHE_TTL.LONG);
}

// Clear all cache (use carefully!)
export async function clearAllUserCache(userId: number) {
  await invalidateCachePattern(CACHE_KEYS.userPattern(userId));
}

// Emergency cache clear
export async function resetAllCache() {
  await clearAllCache();
}
*/

// ============================================================================
// CACHE STRATEGY RECOMMENDATIONS
// ============================================================================

/*
1. DASHBOARD DATA - Cache for 5 minutes
   - High frequency queries
   - Acceptable staleness of 5 minutes
   - Invalidate when transactions/budgets change

2. MONTHLY AGGREGATES - Cache for 30 minutes
   - Relatively stable once the month is past first few days
   - Invalidate when new transactions added
   - Use month-based keys for natural expiration

3. USER PROFILES - Cache for 30-60 minutes
   - Rarely change
   - Invalidate on update

4. TRANSACTION LISTS - Cache for 1-5 minutes
   - Frequent writes, frequent reads
   - Shorter TTL due to volatility
   - Invalidate immediately on create/update/delete

5. BUDGETS - Cache for 30 minutes
   - Relatively stable
   - Invalidate on update/delete

KEY DECISIONS FOR STARTUP WITH UPSTASH:
- Short TTLs (1-5 min) for volatile data to keep data fresh
- Explicit key invalidation (Upstash doesn't support pattern matching)
- Graceful fallback if Redis is unavailable
- Monitor cache hit rates in Upstash console
- Start with heavy caching, reduce as needed
- Use structured cache keys for easy tracking (dashboard:*, transactions:*, etc.)
*/
