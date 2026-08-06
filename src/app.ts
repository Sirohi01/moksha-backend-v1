import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env, isProd } from "./config/env";
import { errorMiddleware, notFoundMiddleware } from "./middlewares/error.middleware";
import { requestIdMiddleware } from "./middlewares/requestId.middleware";
import routes from "./routes";
import { handleRazorpayWebhook } from "./modules/donation/donation.webhook";

export function createApp(): Application {
  const app = express();

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(
    cors({
      origin: [env.CLIENT_URL, env.ADMIN_CLIENT_URL],
      credentials: true,
    })
  );
  app.use(morgan(isProd ? "combined" : "dev"));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Mounted BEFORE express.json() and given its own raw-body parser: signature verification needs
  // the exact bytes Razorpay signed, which express.json() would otherwise have already consumed
  // and reserialized (JSON.stringify(JSON.parse(x)) is not guaranteed to equal x byte-for-byte).
  app.post(
    `${env.API_PREFIX}/donations/webhook/razorpay`,
    express.raw({ type: "application/json" }),
    handleRazorpayWebhook
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ success: true, message: "Moksha Sewa API is running" });
  });

  app.use(env.API_PREFIX, routes);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
