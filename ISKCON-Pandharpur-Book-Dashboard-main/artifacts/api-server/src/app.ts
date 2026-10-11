import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { firebaseAuthMiddleware } from "./middlewares/firebaseAuth";

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

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply Firebase authentication to all /api routes except health check
app.use("/api", (req, res, next) => {
  // Skip auth for health check
  if (req.path === "/healthz") {
    return next();
  }
  
  // Apply Firebase auth middleware
  return firebaseAuthMiddleware(req, res, next);
});

app.use("/api", router);

export default app;
