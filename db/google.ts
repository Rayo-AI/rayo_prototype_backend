import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AuthRepository } from '../src/repository/auth';
import environment from './env';
import { logger } from '../src/lib/logger.ts';

// Validate Google OAuth configuration
const googleClientId = environment.GOOGLE_OAUTH.CLIENT_ID;
const googleClientSecret = environment.GOOGLE_OAUTH.CLIENT_SECRET;
const googleRedirectUri = environment.GOOGLE_OAUTH.CALLBACK_URL || 'http://localhost:4000/api/v1/auth/google/callback';

if (!googleClientId || !googleClientSecret) {
  logger.error('Missing Google OAuth credentials. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env');
  process.exit(1);
}

if (!googleRedirectUri) {
  logger.error('Missing Google OAuth redirect URI. Set GOOGLE_OAUTH_CALLBACK_URL or GOOGLE_OAUTH_REDIRECT_URI in .env');
  process.exit(1);
}

logger.info('Google OAuth configured with redirect URI: ' + googleRedirectUri);

passport.use(
  new GoogleStrategy(
    {
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: googleRedirectUri,
      passReqToCallback: true, // Enables passing the request to the callback
    },
    async (req: any, _accessToken: any, _refreshToken: any, profile: any, done: any) => {
      try {
        console.log('Google profile:', profile);

        const googleId = String(profile.id);
        
        // Check if user already exists with this Google ID
        let user = await AuthRepository.findUserByGoogleId(googleId);

        if (user) {
          return done(null, {
            ...user,
            isNewUser: false,
          });
        }

        const email = profile.emails?.[0]?.value;

        if (!email) {
          throw new Error("Google profile does not have an email");
        }

        const existingUser = await AuthRepository.findUserByEmail(email);

        if (existingUser) {
          user = await AuthRepository.updateUser(existingUser.id, {
            googleId,
            googleEmail: email,
            profileImage: profile.photos?.[0]?.value,
            emailVerified: true,
          });

          return done(null, {
            ...user,
            isNewUser: false,
          });
        }

        user = await AuthRepository.createUser(
          profile.displayName ||
            profile.emails?.[0]?.value?.split("@")[0] ||
            "User",
          email,
          null,
          {
            googleId,
            googleEmail: email,
            profileImage: profile.photos?.[0]?.value,
            emailVerified: profile.emails?.[0]?.verified ?? true,
          }
        );

        return done(null, {
          ...user,
          isNewUser: true,
        });
      } catch (error) {
        console.error('Error during Google authentication:', error);
        return done(error);
      }
    }
  )
);

// Serialize user for session (not used with session: false, but included for completeness)
passport.serializeUser((user: any, done: any) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: number, done: any) => {
  try {
    const user = await AuthRepository.findUserById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;