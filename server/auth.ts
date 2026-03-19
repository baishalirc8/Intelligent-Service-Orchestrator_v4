import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { Express, Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";
import { COUNTRIES } from "@shared/countries";

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      role: string;
      displayName: string;
      email: string | null;
      companyName: string | null;
      country: string | null;
      avatarUrl: string | null;
      onboardingCompleted: boolean;
      tourCompleted: boolean;
    }
  }
}

const PgSession = connectPgSimple(session);

export function setupAuth(app: Express) {
  const sessionStore = new PgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
  });

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) return done(null, false, { message: "Invalid credentials" });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return done(null, false, { message: "Invalid credentials" });
        return done(null, {
          id: user.id,
          username: user.username,
          role: user.role,
          displayName: user.displayName,
          email: user.email,
          companyName: user.companyName,
          country: user.country,
          avatarUrl: user.avatarUrl,
          onboardingCompleted: user.onboardingCompleted,
          tourCompleted: user.tourCompleted,
        });
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      done(null, {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        email: user.email,
        companyName: user.companyName,
        country: user.country,
        avatarUrl: user.avatarUrl,
        onboardingCompleted: user.onboardingCompleted,
        tourCompleted: user.tourCompleted,
      });
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, password, displayName, email, companyName, country } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "Username, password, and display name are required" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }
      let validatedCountry: string | null = null;
      if (country) {
        const found = COUNTRIES.find(c => c.code === country);
        if (!found) {
          return res.status(400).json({ message: "Invalid country code" });
        }
        validatedCountry = country;
      }
      const hashed = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username,
        password: hashed,
        displayName,
        email: email || null,
        companyName: companyName || null,
        country: validatedCountry,
        role: "client",
      });
      req.login(
        {
          id: user.id,
          username: user.username,
          role: user.role,
          displayName: user.displayName,
          email: user.email,
          companyName: user.companyName,
          country: user.country,
          avatarUrl: user.avatarUrl,
          onboardingCompleted: user.onboardingCompleted,
          tourCompleted: user.tourCompleted,
        },
        (err) => {
          if (err) return res.status(500).json({ message: "Login failed" });
          return res.status(201).json({
            id: user.id,
            username: user.username,
            role: user.role,
            displayName: user.displayName,
            email: user.email,
            companyName: user.companyName,
            country: user.country,
            onboardingCompleted: user.onboardingCompleted,
          });
        }
      );
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.json({
          id: user.id,
          username: user.username,
          role: user.role,
          displayName: user.displayName,
          email: user.email,
          companyName: user.companyName,
          onboardingCompleted: user.onboardingCompleted,
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json(req.user);
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ message: "Authentication required" });
}
