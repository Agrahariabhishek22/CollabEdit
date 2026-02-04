import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
dotenv.config();

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log("Google Profile:", profile); // Add this
                const user = await User.findOne({ googleId: profile.id });

                if (user) return done(null, user);
                
                const newUser = await User.create({
                    googleId: profile.id,
                    name: profile.displayName,
                    email: profile.emails[0].value,
                });

                return done(null, newUser);
            } catch (error) {
                console.error("Google Auth Error:", error); // Add this
                return done(error, null);
            }
        }
    )
);
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
