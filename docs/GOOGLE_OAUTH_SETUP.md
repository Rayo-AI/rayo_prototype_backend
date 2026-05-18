# Google OAuth Implementation Guide

## Overview

Google OAuth has been integrated into your Rayo Finance API. Users can now:
- Sign up/login using their Google account
- Link their Google account to existing credentials
- Auto-verify email on Google login

## Setup Instructions

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     ```
     http://localhost:3000/api/auth/google/callback  (development)
     https://yourdomain.com/api/auth/google/callback  (production)
     ```
   - Copy the **Client ID** and **Client Secret**

### 2. Environment Variables

Add to your `.env` or `.env.local`:

```env
GOOGLE_OAUTH_CLIENT_ID=your_client_id_here
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret_here
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

### 3. Database Migration

Run the Drizzle migration to add Google OAuth fields:

```bash
npm run db:push
```

This adds the following fields to the users table:
- `google_id` - Unique Google user ID
- `google_email` - Email from Google profile
- `google_image` - Profile picture URL

### 4. Frontend Integration

#### Option A: Using Google Sign-In Button

```html
<!-- Add Google Sign-In script -->
<script src="https://accounts.google.com/gsi/client" async defer></script>

<div id="g_id_onload"
     data-client_id="YOUR_CLIENT_ID"
     data-callback="handleCredentialResponse">
</div>
<div class="g_id_signin" data-type="standard"></div>
```

#### Option B: Using `@react-oauth/google` (React)

```bash
npm install @react-oauth/google
```

```tsx
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

export function LoginPage() {
  const handleGoogleLogin = async (response: CredentialResponse) => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: response.credential, // JWT from Google
        email: response.email,
        name: response.name,
        image: response.picture,
      }),
    });

    const data = await res.json();
    if (data.success) {
      localStorage.setItem('token', data.data.token);
      // Redirect to dashboard
    }
  };

  return (
    <GoogleOAuthProvider clientId="YOUR_CLIENT_ID">
      <GoogleLogin onSuccess={handleGoogleLogin} />
    </GoogleOAuthProvider>
  );
}
```

### 5. Backend Endpoint

**POST** `/api/auth/google`

Request body:
```json
{
  "id": "google_user_id",
  "email": "user@gmail.com",
  "name": "User Name",
  "image": "https://lh3.googleusercontent.com/..."
}
```

Response:
```json
{
  "success": true,
  "message": "",
  "data": {
    "token": "jwt_token",
    "user": {
      "id": 1,
      "name": "User Name",
      "email": "user@gmail.com",
      "envelopeBased": true
    }
  }
}
```

## Authentication Flow

### New User via Google OAuth

```
1. User clicks "Sign in with Google"
   ↓
2. Google returns: { id, email, name, image }
   ↓
3. Backend checks if user exists with googleId
   ↓
4. User not found, checks if email exists
   ↓
5. Email not found → Create new user with Google profile
   ↓
6. Generate JWT token
   ↓
7. Return token + user info
```

### Existing User Linking Google Account

```
1. User has password-based account
   ↓
2. User clicks "Link Google Account"
   ↓
3. Google returns: { id, email, name, image }
   ↓
4. Backend checks if user exists with googleId
   ↓
5. User not found, checks if email matches existing account
   ↓
6. Email matches → Link Google profile to existing account
   ↓
7. Generate JWT token
   ↓
8. Return token
```

### Returning User via Google OAuth

```
1. User clicks "Sign in with Google"
   ↓
2. Google returns: { id, email, name, image }
   ↓
3. Backend finds user by googleId
   ↓
4. User found → Generate JWT token
   ↓
5. Return token + user info
```

## Security Features

✅ **Rate Limited** - Uses `signupLimiter` (3 attempts/hour)  
✅ **Email Verified** - Google login auto-verifies email  
✅ **Optional Password** - Google users don't need passwords  
✅ **Account Linking** - Auto-links to existing email account  
✅ **Profile Picture** - Stores and can display Google avatar  

## Database Schema Changes

```sql
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN google_email TEXT;
ALTER TABLE users ADD COLUMN google_image TEXT;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
```

## Testing

### Local Testing

1. Create a test Google OAuth credential in Google Cloud Console
2. Set environment variables:
   ```bash
   GOOGLE_OAUTH_CLIENT_ID=test_client_id
   GOOGLE_OAUTH_CLIENT_SECRET=test_client_secret
   GOOGLE_OAUTH_REDIRECT_URI=http://localhost:4000/api/auth/google
   ```

3. Start your server: `npm run dev`

4. Test with curl:
   ```bash
   curl -X POST http://localhost:4000/api/auth/google \
     -H "Content-Type: application/json" \
     -d '{
       "id": "test_google_id",
       "email": "test@gmail.com",
       "name": "Test User",
       "image": "https://example.com/photo.jpg"
     }'
   ```

## Troubleshooting

### "Invalid Google credentials"
- Verify `GOOGLE_OAUTH_CLIENT_ID` is correct
- Ensure Google+ API is enabled in Google Cloud Console
- Check redirect URI matches exactly

### "Email already exists"
- User already has an account with that email
- They should log in with password or link accounts

### "Failed to authenticate with Google"
- Check server logs for database errors
- Ensure database migration was run: `npm run db:push`

### Frontend not sending credentials correctly
- Verify Google Sign-In script is loaded
- Check that JWT/ID token is being extracted properly
- Ensure frontend is sending POST to `/api/auth/google`

## Resources

- [Google Sign-In Documentation](https://developers.google.com/identity/gsi/web)
- [Google OAuth 2.0 Overview](https://developers.google.com/identity/protocols/oauth2)
- [React Google Login (@react-oauth/google)](https://www.npmjs.com/package/@react-oauth/google)

## Future Enhancements

Consider adding:
- GitHub OAuth
- Microsoft OAuth
- Apple Sign-In
- Social account unlinking
- Multiple OAuth provider support per user
