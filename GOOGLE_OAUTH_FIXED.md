# Google OAuth Fixed Implementation Guide

## What Was Fixed

The `db/google.ts` file has been corrected to properly use your `AuthRepository` methods:

### Before (Broken)
```typescript
const authRepo: any = AuthRepository as any;
if (typeof authRepo.create === 'function') {
  user = await authRepo.create(newUserData);
} else if (typeof authRepo.insert === 'function') {
  user = await authRepo.insert(newUserData);
} else {
  user = newUserData as any; // ❌ Fallback to plain object
}
```

### After (Fixed)
```typescript
// Properly use AuthRepository methods
let user = await AuthRepository.findUserByGoogleId(googleId);

if (user) {
  return done(null, user);
}

const email = profile.emails?.[0]?.value;
const existingUser = await AuthRepository.findUserByEmail(email);

if (existingUser) {
  // Link Google to existing account
  user = await AuthRepository.updateUser(existingUser.id, {
    googleId,
    googleEmail: email,
    googleImage: profile.photos?.[0]?.value,
    image: profile.photos?.[0]?.value,
    emailVerified: true,
  });
} else {
  // Create new user
  user = await AuthRepository.createUser(
    profile.displayName || profile.emails?.[0]?.value?.split('@')[0] || 'User',
    email,
    null, // No password for OAuth users
    {
      googleId,
      googleEmail: email,
      googleImage: profile.photos?.[0]?.value,
      image: profile.photos?.[0]?.value,
      emailVerified: profile.emails?.[0]?.verified ?? true,
    }
  );
}
```

## Key Improvements

✅ **Uses correct methods**: `createUser()`, `findUserByGoogleId()`, `findUserByEmail()`, `updateUser()`  
✅ **Proper error handling**: Throws error if no email in profile  
✅ **Account linking**: Links Google to existing email-based accounts  
✅ **Image handling**: Extracts Google profile photo correctly  
✅ **No more type casting**: Removed dangerous `as any` fallbacks  
✅ **Removed role field**: No longer requires non-existent role parameter  

## Two Implementation Options

### Option A: Frontend OAuth (Current Implementation) ✅ RECOMMENDED
**File**: `src/routes/auth.ts` → `POST /api/auth/google`

```bash
# How to use from frontend
const response = await fetch('/api/auth/google', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: googleProfile.id,
    email: googleProfile.email,
    name: googleProfile.name,
    image: googleProfile.picture,
  })
});
```

**Pros:**
- Simple, works with frontend OAuth libraries
- No session management needed
- Returns JWT token directly
- Already integrated ✅

**Cons:**
- Requires frontend to handle OAuth redirect
- Token sharing between client and server

---

### Option B: Server-Side Passport Strategy (Now Fixed)
**File**: `db/google.ts`

Uses the official OAuth flow where Google redirects to your server.

#### To Enable Passport Integration:

1. **Add Passport middleware to `src/app.ts`:**

```typescript
import passport from '../db/google.ts';
import cookieParser from 'cookie-parser';

app.use(cookieParser());

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Serialize/deserialize user for sessions
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

2. **Add routes to `src/routes/auth.ts`:**

```typescript
import passport from '../../db/google.ts';
import { createToken } from '../lib/auth.ts';
import { appResponse } from '../utils/appResponse.ts';

// Google OAuth initiation
router.get('/auth/google', 
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    // Optional: pass state for additional context
    state: 'provider=google'
  })
);

// Google OAuth callback
router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    const user = req.user as any;
    
    if (!user) {
      return res.redirect('/login?error=auth_failed');
    }

    // Generate JWT token
    const token = await createToken({ userId: user.id });
    
    // Redirect to frontend with token
    const redirectUrl = `${process.env.APP_URL}/auth/callback?token=${token}&userId=${user.id}`;
    res.redirect(redirectUrl);
  }
);
```

3. **Update environment variables:**

Ensure these are set in `.env`:

```env
GOOGLE_OAUTH_CLIENT_ID=your_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
GOOGLE_OAUTH_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
APP_URL=http://localhost:4000  # Your frontend URL
```

**Pros:**
- Official OAuth 2.0 flow
- More secure (tokens never exposed to client)
- Standard practice
- Session support included

**Cons:**
- Requires session management
- More complex setup
- Need redirect handling on frontend

---

## Environment Variables Required

```env
# Google OAuth Configuration
GOOGLE_OAUTH_CLIENT_ID=<your_client_id>
GOOGLE_OAUTH_CLIENT_SECRET=<your_client_secret>
GOOGLE_OAUTH_CALLBACK_URL=<your_backend_callback_url>
GOOGLE_OAUTH_REDIRECT_URI=<same_as_callback>

# Frontend URL (for redirects)
APP_URL=http://localhost:4000

# JWT Configuration
JWT_SECRET=<your_secret>
JWT_EXPIRES_IN=7d
```

## Testing the Fixed Code

### Current Option (Frontend OAuth)

```bash
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "id": "google_id_123",
    "email": "user@example.com",
    "name": "John Doe",
    "image": "https://example.com/photo.jpg"
  }'
```

### Option to Enable (Server OAuth)

```bash
# 1. Redirect user to:
http://localhost:3000/api/auth/google

# 2. User logs in with Google
# 3. Google redirects to callback with authorization code
# 4. Backend exchanges code for user profile
# 5. Backend redirects to frontend with token
```

## Database Fields Supported

Your `usersTable` already has all the fields needed:

```typescript
googleId: text("google_id").unique(),
googleEmail: text("google_email"),
googleImage: text("google_image"),
image: text("image"),  // Can store any profile image
emailVerified: boolean("email_verified").default(false),
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Google profile does not have an email" | Ensure user's Google account has public email |
| "Invalid credentials" | Check GOOGLE_OAUTH_CLIENT_ID and CLIENT_SECRET |
| TypeScript errors | Run `npm run typecheck` (should now pass ✅) |
| Account not linking | Ensure existing user has same email as Google account |
| Image not updating | Verify Google profile has photo and `profile.photos[0].value` is accessible |

## Recommendation

**For your current setup, stick with Option A** (Frontend OAuth - `POST /api/auth/google`):
- Already implemented ✅
- Works with modern frontend libraries
- Returns JWT directly
- Simpler to maintain

The Passport strategy in `db/google.ts` is now **fixed and ready** if you want to migrate to Option B later.

## Files Modified

- ✅ `db/google.ts` - Fixed method calls and data handling
- ✅ `package.json` - Added `passport` and `passport-google-oauth20`
- ✅ Type checking - All TypeScript types verified
