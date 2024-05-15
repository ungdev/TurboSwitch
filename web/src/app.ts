import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import * as Sentry from "@sentry/node";
import webRouter from "./webRouter";
import apiRouter from "./apiRouter";

dotenv.config();
const app = express();

if (process.env.SENTRY_DSN) {
  // Initiate Sentry
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  });
  Sentry.setupExpressErrorHandler(app);
}

// Enable morgan logger
// app.use(morgan());

// Enable compression
// app.use(compression());

// Security middlewares
// app.use(cors(), helmet());

app.use("", cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

// Main routes
app.use(process.env.API_PREFIX, apiRouter);
app.use("", webRouter);

// Not found
// app.use((request: Request, response: Response) => notFound(response, Error.RouteNotFound));

// Error Handles
// app.use(errorHandler);

export default app;
