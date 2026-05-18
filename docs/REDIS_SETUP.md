# Upstash Redis Caching Setup for Rayo Finance

## Why Upstash?

Upstash Redis is perfect for startups:
- ✅ **Serverless** - No server management
- ✅ **Free tier** - Up to 10,000 commands/day
- ✅ **REST API** - Works with serverless functions (Vercel, Netlify, etc.)
- ✅ **Pay as you go** - Only pay for what you use
- ✅ **Global** - Distributed edge locations

## Quick Start

### 1. Get Upstash Credentials

1. Go to [console.upstash.com](https://console.upstash.com)
2. Sign up (free)
3. Create a new Redis database
4. Copy the **REST URL** and **REST Token** from the dashboard

### 2. Add to `.env.local`

```env
UPSTASH_REDIS_REST_URL=https://your-db-name.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

### 3. Test Connection

Start your server and check logs:
```
Upstash Redis client initialized
```

## Files Added/Updated

1. **`src/lib/redis.ts`** - Upstash Redis client initialization
2. **`src/lib/cache.ts`** - Caching utilities with Upstash support
3. **`src/lib/cacheKeys.ts`** - Cache key organization
4. **`CACHE_IMPLEMENTATION_GUIDE.md`** - Code examples

## Usage

### Basic Example
```typescript
import { getCached } from '../lib/cache';
import { CACHE_KEYS, CACHE_TTL } from '../lib/cacheKeys';

const data = await getCached(
  CACHE_KEYS.dashboardMonth(userId, 'month'),
  async () => {
    // Expensive operation
    return fetchDashboardData();
  },
  CACHE_TTL.MEDIUM // 5 minutes
);
```

### Invalidate Cache
```typescript
import { invalidateCache } from '../lib/cache';

// After creating a transaction
await invalidateCache(CACHE_KEYS.dashboard(userId));
```

## Important: Upstash Limitations

Upstash REST API doesn't support:
- **KEYS pattern matching** - Use specific cache keys instead
- **FLUSHDB** - Clear individual keys using `invalidateCache()`

For pattern invalidation, track related keys explicitly:
```typescript
// Instead of invalidating by pattern:
// ❌ invalidateCachePattern(`transactions:*:${userId}:*`);

// Do this:
✅ await Promise.all([
  invalidateCache(CACHE_KEYS.dashboard(userId)),
  invalidateCache(CACHE_KEYS.transactionsMonth(userId, '2024-05')),
  invalidateCache(CACHE_KEYS.monthlyIncome(userId, '2024-05')),
]);
```

## Cache Strategy

### What to Cache

**Priority 1 - High Impact:**
- Dashboard summary (5 min TTL)
- Monthly aggregates (30 min TTL)
- User profile (30 min TTL)

**Priority 2 - Medium Impact:**
- Budget data (30 min TTL)
- Savings goals (30 min TTL)

**Priority 3 - Nice to Have:**
- Transaction lists (5 min TTL)
- AI insights (1 hour TTL)

### Cache TTL Presets

```typescript
CACHE_TTL.SHORT = 60        // 1 minute
CACHE_TTL.MEDIUM = 300      // 5 minutes
CACHE_TTL.LONG = 1800       // 30 minutes
CACHE_TTL.VERY_LONG = 7200  // 2 hours
```

## Monitoring

### Check Cache Usage (Upstash Console)

1. Go to [console.upstash.com](https://console.upstash.com)
2. Select your database
3. View **Commands**, **Keys**, and **Usage**

### Debugging Locally

```typescript
// In your handlers:
const data = await getCached(key, fetchFn, ttl);
// Logs will show "Cache hit" or "Cache miss"
```

## Cost Estimation

**Free Tier:**
- 10,000 commands/day
- 256 MB storage
- Perfect for MVP/startup

**Example Usage:**
- Dashboard refresh (5 commands)
- 200 daily users = 1,000 commands ✅
- Transaction creation (1 command)

**Pricing:**
- Overages: $0.20 per 100,000 commands
- Very affordable at scale

## Production Checklist

- [ ] Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in production
- [ ] Implement cache invalidation on data mutations
- [ ] Monitor cache hit rates in Upstash console
- [ ] Set up alerts for quota usage
- [ ] Test graceful degradation (app works without cache)

## Troubleshooting

**"Upstash Redis credentials not configured"**
- Check `.env.local` has `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Verify credentials from console.upstash.com

**Cache not working**
- Check logs for errors
- Verify database is active in Upstash console
- Test API token is correct

**High cache misses**
- Reduce TTLs for more frequent caching
- Ensure cache keys are consistent
- Check cache invalidation logic

---

See `CACHE_IMPLEMENTATION_GUIDE.md` for detailed code examples.
