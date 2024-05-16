import express, { json, urlencoded } from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import * as Sentry from "@sentry/node";
import webRouter from "./webRouter";
import apiRouter from "./apiRouter";
import ejs from "ejs";

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
app.engine('html', ejs.renderFile);

// Enable morgan logger
// app.use(morgan());

// Enable compression
// app.use(compression());

// Security middlewares
// app.use(cors(), helmet());

app.use("", cookieParser());
app.use(json());
app.use(urlencoded({ extended: true }));

app.use(express.static('public'));

// Main routes
app.use(process.env.API_PREFIX, apiRouter);
app.use("", webRouter);

// Not found
// app.use((request: Request, response: Response) => notFound(response, Error.RouteNotFound));

// Error Handles
// app.use(errorHandler);

export default app;
