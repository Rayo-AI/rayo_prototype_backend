# Google OAuth Fix - redirect_uri Error Resolution

## Problem
You were getting: `Missing required parameter: redirect_uri` from Google

## Root Cause
The Passport GoogleStrategy was configured with an undefined `callbackURL` because the environment variable `GOOGLE_OAUTH_CALLBACK_URL` wasn't set or was undefined.

## What Was Fixed

### 1. **Fixed Environment Configuration** (`db/google.ts`)
Added validation and fallback logic:
```typescript
const googleRedirectUri = environment.GOOGLE_OAUTH.CALLBACK_URL 
  || environment.GOOGLE_OAUTH.REDIRECT_URI 
  || 'http://localhost:3000/api/auth/google/callback';
```

Now it:
- ✅ Tries `GOOGLE_OAUTH_CALLBACK_URL` first
- ✅ Falls back to `GOOGLE_OAUTH_REDIRECT_URI` if not set
- ✅ Has a sensible default for local development
- ✅ Validates that both CLIENT_ID and CLIENT_SECRET are set
- ✅ Logs the configured redirect URI for debugging

### 2. **Fixed Route Configuration** (`src/routes/auth.ts`)
Corrected the Passport middleware usage:

**Before (Broken):**
```typescript
router.get("/auth/google/callback", signupLimiter, googleOAuthCallback);
```
The callback handler tried to re-authenticate instead of receiving the already-authenticated user.

**After (Fixed):**
```typescript
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback", passport.authenticate("google", { session: false, failureRedirect: "/login" }), googleOAuthCallback);
```

### 3. **Fixed Handler Logic** (`src/handlers/auth.ts`)
Simplified the callback handler to receive the already-authenticated user from Passport:

**Before (Broken):**
```typescript
export const googleOAuthCallback = asyncHandler(async (req, res, next) => {
  passport.authenticate('google', {...}, async (err, user, info) => {
    // Complicated custom callback logic
  })(req, res, next);
});
```

**After (Fixed):**
```typescript
export const googleOAuthCallback = asyncHandler(async (req, res) => {
  const user = req.user as any;
  if (!user || !user.id) {
    throw new ErrorResponse("Failed to authenticate with Google", 500);
  }
  
  const token = await createToken({ userId: user.id });
  return appResponse(res, 200, AuthLoginResponse.parse({
    token,
    user: { id: user.id, name: user.name, email: user.email, envelopeBased: user.envelopeBased, image: user.image }
  }));
});
```

### 4. **Added Passport Initialization** (`src/app.ts`)
```typescript
import passport from "../db/google.ts";

// Initialize Passport for Google OAuth
app.use(passport.initialize());
```

### 5. **Added User Serialization** (`db/google.ts`)
```typescript
passport.serializeUser((user: any, done: any) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done: any) => {
  try {
    const user = await AuthRepository.findUserById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});
```

## How to Use

### 1. Set Environment Variables

Add to your `.env` file:

```env
# Google OAuth Configuration (get these from Google Cloud Console)
GOOGLE_OAUTH_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret_here

# This MUST match exactly what you set in Google Cloud Console
GOOGLE_OAUTH_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
# OR use the alternative name
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/v1/auth/google/callback
```

### 2. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "Google+ API"
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/v1/auth/google/callback`
   - Production: `https://yourdomain.com/api/v1/auth/google/callback`
6. Copy the Client ID and Client Secret

### 3. Frontend OAuth Flow

**On your frontend (React/Vue/etc):**

```javascript
// 1. Use Google Sign-In Button
// Redirect user to your backend OAuth initiation endpoint
window.location.href = 'http://localhost:3000/api/v1/auth/google';

// OR use a Google Sign-In library and send the token to your backend
```

### 4. Backend Flow

1. User clicks "Login with Google" on frontend
2. Frontend redirects to: `GET /api/v1/auth/google`
3. Passport redirects to Google login page
4. User logs in with Google
5. Google redirects back to: `GET /api/v1/auth/google/callback?code=...`
6. Passport exchanges code for user profile
7. Your `db/google.ts` strategy:
   - Looks up or creates user in database
   - Links Google account to existing email if found
   - Returns user to handler
8. Handler generates JWT token and returns to frontend

## API Flow Diagram

```
Frontend                          Backend                              Google
  │                                 │                                    │
  ├─ Click "Login with Google" ─────>│                                   │
  │                                  │                                   │
  │                                  ├─ GET /auth/google ────────────────>│
  │                                  │                                   │
  │                                  <─ Redirect to Google login ────────│
  │                                  │                                   │
  │  <─ Redirect to Google login ────┤                                   │
  │                                  │                                   │
  │  (User logs in on Google)        │                                   │
  │                                  │                                   │
  │  <─ Redirect to /callback ────────┤───────── Auth code + state ──────┤
  │                                  │                                   │
  │                                  ├─ Exchange code for profile ──────>│
  │                                  │                                   │
  │                                  <─ User profile ────────────────────┤
  │                                  │                                   │
  │                                  ├─ Create/Link user in DB           │
  │                                  │                                   │
  │                                  ├─ Generate JWT token               │
  │                                  │                                   │
  │  <─ Redirect + JWT token ────────┤                                   │
  │                                  │                                   │
  ├─ Save token, redirect to app ──> │                                   │
```

## Testing

### Test the OAuth Flow

```bash
# 1. Start the server
npm run dev

# 2. In browser, visit:
http://localhost:3000/api/v1/auth/google

# 3. You'll be redirected to Google login
# 4. After logging in, you'll get a JWT token
# 5. Save the token and use it for authenticated requests
```

### Test with cURL (Frontend OAuth)

If you're testing the direct `POST /api/auth/google` endpoint:

```bash
curl -X POST http://localhost:3000/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "id": "google_id_123",
    "email": "user@example.com",
    "name": "John Doe",
    "image": "https://lh3.googleusercontent.com/..."
  }'
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Missing required parameter: redirect_uri" | ✅ Fixed! Set `GOOGLE_OAUTH_CALLBACK_URL` or `GOOGLE_OAUTH_REDIRECT_URI` in `.env` |
| "Invalid OAuth client" | Check that CLIENT_ID and CLIENT_SECRET are correct in `.env` |
| "Redirect URI mismatch" | The callback URL in `.env` must match EXACTLY what's registered in Google Cloud Console |
| "Cannot read property 'id' of undefined" | Google OAuth credentials not set in environment |
| "Session already exists" | Clear cookies and try again, or use incognito window |
| Infinite redirect loop | Check your failureRedirect path and ensure it's different from callback |

## Files Modified

- ✅ `db/google.ts` - Added validation, serialization, and proper config
- ✅ `src/routes/auth.ts` - Fixed Passport middleware usage
- ✅ `src/handlers/auth.ts` - Simplified callback handler
- ✅ `src/app.ts` - Added Passport initialization

## Security Notes

- ✅ Using `session: false` - No session cookies stored
- ✅ Using JWT tokens - Stateless authentication
- ✅ User data validated in database
- ✅ Existing email accounts can be linked to Google
- ✅ Profile images stored in Cloudinary
- ✅ All operations are logged

## Next Steps

1. **Set your Google OAuth credentials** in `.env`
2. **Test the flow** in development
3. **Update frontend** to redirect to `GET /api/v1/auth/google`
4. **Test in production** with production redirect URI
