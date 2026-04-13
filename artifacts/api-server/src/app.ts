import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import adminRouter from "./routes/admin";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(helmet());

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
const allowedOrigins = new Set([
  'https://superscout.pro',
  process.env.CORS_ALLOWED_ORIGIN || 'http://localhost:3000',
]);
if (process.env.REPLIT_DEV_DOMAIN) {
  allowedOrigins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
}
if (process.env.REPLIT_EXPO_DEV_DOMAIN) {
  allowedOrigins.add(`https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`);
}
if (process.env.REPLIT_DEPLOYMENT_URL) {
  allowedOrigins.add(process.env.REPLIT_DEPLOYMENT_URL);
}
allowedOrigins.add('https://super-scout.replit.app');
const isDev = process.env.NODE_ENV !== 'production';
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else if (isDev && /^https:\/\/[a-z0-9-]+\.(?:worf\.)?replit\.dev$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(cookieParser(process.env.COOKIE_SECRET || "superscout-dev-secret"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
});

const dataRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
});

app.use("/api/captain-picks", aiRateLimiter);
app.use("/api/transfer-advice", aiRateLimiter);
app.use("/api/banter/generate", aiRateLimiter);
app.use("/api/report-card/generate", aiRateLimiter);
app.use("/api/squad-card/generate", aiRateLimiter);

app.use("/api/admin", adminRouter);
app.use("/api", dataRateLimiter, router);

export default app;
