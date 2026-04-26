import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import Router from "./routes/index.ts";
import { logger } from "./lib/logger.ts";
import { errorHandler } from "./middlewares/errorHandler.ts";
import { asyncHandler } from "./utils/asyncHandler.ts";

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", asyncHandler(async (req, res) => {
  res.json({ message: "Welcome to Rayo Finance API" });
}));

app.use("/api", Router);

function notFound(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`) as Error & { statusCode: number };
  err.statusCode = 404;
  next(err);
}

app.use(notFound);
app.use(errorHandler);

export default app;
