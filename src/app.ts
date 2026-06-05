import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import * as Sentry from "@sentry/node";
import Router from "./routes/index.ts";
import { logger } from "./lib/logger.ts";
import { errorHandler } from "./middlewares/errorHandler.ts";
import { asyncHandler } from "./utils/asyncHandler.ts";
import { apiLimiter } from "./lib/rateLimiter.ts";
import passport from "../db/google.ts";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://rayo-prototype-frontend.vercel.app",
    ],
    credentials: true, // allows Set-Cookie to be sent cross-origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Passport for Google OAuth
app.use(passport.initialize());

// Apply rate limiting to all API routes
app.use('/api/v1/', apiLimiter);
app.set("trust proxy", 1);

app.get("/", asyncHandler(async (req, res) => {
  res.json({ message: "Welcome to Rayo Finance API" });
}));

app.use("/api/v1", Router);

function notFound(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`) as Error & { statusCode: number };
  err.statusCode = 404;
  next(err);
}

app.use(notFound);

// Sentry error handler - use official setupExpressErrorHandler
Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

export default app;
