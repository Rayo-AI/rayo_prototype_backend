# Sentry Error Monitoring Implementation

## Overview

Sentry has been integrated into your Rayo Finance API for comprehensive error tracking and monitoring. All errors are sent to Sentry and **NOT logged to the server terminal** for security purposes.

## Setup

### Environment Variables

Add the following to your `.env` or `.env.local` file:

```env
SENTRY_DSN=your_sentry_dsn_here
NODE_ENV=production
```

**Key Points:**
- Sentry is disabled in development mode (`NODE_ENV !== "development"`)
- In production, all errors are silently captured to Sentry
- No sensitive information is logged to the console

## Architecture

### 1. **Sentry Initialization** (`src/lib/sentry.ts`)

The main Sentry module provides:

- `initSentry()` - Initializes Sentry at application startup
- `captureError()` - Captures errors with context
- `captureMessage()` - Captures messages
- `setUserContext()` - Associates errors with a user ID
- `clearUserContext()` - Clears user context
- `addBreadcrumb()` - Adds debugging breadcrumbs
- `startTransaction()` - Starts performance monitoring

### 2. **Error Handling Flow**

```
Request
  ↓
Sentry Request Handler (app.ts)
  ↓
Route Handler (asyncHandler catches errors)
  ↓
AsyncHandler captures error to Sentry
  ↓
Error Handler Middleware
  ↓
Error Handler captures to Sentry + responds to client
  ↓
Sentry Error Handler (app.ts)
  ↓
Response sent to client (sanitized, no internal details exposed)
```

### 3. **Error Types Handled**

| Error Type | Sentry Level | Console Output |
|-----------|-------------|-----------------|
| 5xx errors | `error` | None (production) |
| 4xx errors | `warning` | None (production) |
| Uncaught exceptions | `fatal` | None |
| Unhandled rejections | `error` | None |

## Usage Examples

### In Route Handlers

```typescript
import { asyncHandler } from "../utils/asyncHandler.ts";
import { captureError } from "../lib/sentry.ts";

export const getUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await db.user.findById(userId);
    
    if (!user) {
      const error = new Error("User not found");
      (error as any).statusCode = 404;
      throw error;
    }
    
    res.json(user);
  } catch (error) {
    // asyncHandler will automatically capture this to Sentry
    throw error;
  }
});
```

### In Services

```typescript
import { captureError, addBreadcrumb } from "../lib/sentry.ts";

export async function sendEmail(email: string) {
  try {
    addBreadcrumb("Attempting to send email", "email", "info", { email });
    
    const result = await emailProvider.send(email);
    
    return result;
  } catch (error) {
    captureError(error, {
      email,
      service: "emailService",
      operation: "sendEmail"
    });
    throw error;
  }
}
```

### Setting User Context

```typescript
import { setUserContext, clearUserContext } from "../lib/sentry.ts";

// After user login
setUserContext(user.id, user.email);

// When user logs out
clearUserContext();
```

### Custom Error Tracking

```typescript
import { captureMessage, captureError } from "../lib/sentry.ts";

// Capture a message
captureMessage("Unusual activity detected", "warning", {
  userId: user.id,
  activity: "multiple_failed_attempts"
});

// Capture with custom context
captureError(error, {
  endpoint: "/api/transactions/create",
  userId: req.user.id,
  payload: sanitizedData
});
```

## Security Features

### 1. **Console Suppression**
- Errors are NOT printed to the server terminal in production
- This prevents malicious actors from seeing stack traces and internal details

### 2. **Sensitive Data Redaction**
Automatically redacted in logger:
- Authorization headers
- Cookies
- Password fields
- Tokens

### 3. **Sanitized Client Response**
In production, generic error messages are sent to clients:
- `500` errors → "An error occurred. Please try again later."
- `4xx` errors → Specific message (validation errors, not found, etc.)

### 4. **Context Collection**
Each error is captured with:
- HTTP method and URL
- Client IP address
- User ID (when available)
- Timestamp
- Custom context data

## Development vs Production

### Development Mode
```env
NODE_ENV=development
```
- Sentry is **disabled**
- Errors are logged to console with pretty formatting
- Useful for debugging

### Production Mode
```env
NODE_ENV=production
SENTRY_DSN=your_sentry_dsn
```
- Sentry is **enabled**
- All errors silently captured to Sentry
- No console output (security)
- Generic error messages sent to clients

## Performance Monitoring

### Trace Sample Rate

Currently set to `0.1` (10% of transactions are traced):

```typescript
tracesSampleRate: 0.1
```

Adjust this based on your needs:
- Development: Use higher values (0.5-1.0) for more visibility
- Production: Use lower values (0.05-0.1) to reduce overhead

## Monitoring Checklist

✅ Sentry initialized in `src/index.ts`
✅ Request/response handlers in `src/app.ts`
✅ Error handler captures to Sentry in `src/middlewares/errorHandler.ts`
✅ Async handlers capture errors in `src/utils/asyncHandler.ts`
✅ Uncaught exceptions handled in `src/index.ts`
✅ Unhandled rejections handled in `src/index.ts`

## Recommended Best Practices

1. **Always use asyncHandler** for route handlers to ensure errors are captured

```typescript
app.get("/users/:id", asyncHandler(async (req, res) => {
  // Your code here
}));
```

2. **Add context to errors** for better debugging

```typescript
captureError(error, {
  userId: req.user?.id,
  operation: "createTransaction",
  amount: transaction.amount
});
```

3. **Use breadcrumbs** for complex operations

```typescript
addBreadcrumb("Step 1: Validate input", "process", "info");
addBreadcrumb("Step 2: Query database", "database", "info");
addBreadcrumb("Step 3: Send response", "http", "info");
```

4. **Set user context after authentication**

```typescript
if (user) {
  setUserContext(user.id, user.email);
}
```

## Troubleshooting

### Errors not appearing in Sentry

1. **Check SENTRY_DSN** is correctly set in environment variables
2. **Check NODE_ENV** - Sentry is disabled in development
3. **Verify Sentry is initialized** - it runs at startup in `src/index.ts`
4. **Check network connectivity** - ensure your server can reach Sentry's servers

### Too many errors in Sentry

- Reduce `tracesSampleRate` in Sentry config
- Add error filtering in `beforeSend` function
- Fix root causes of errors in your code

### Performance impact

- Sentry has minimal overhead when properly configured
- Use appropriate `tracesSampleRate` for your needs
- Monitor server performance before and after enabling Sentry

## Resources

- [Sentry Node.js Documentation](https://docs.sentry.io/platforms/node/)
- [Sentry Best Practices](https://docs.sentry.io/product/best-practices/)
- [Sentry Error Filtering](https://docs.sentry.io/product/integrations/integration-platform/)
