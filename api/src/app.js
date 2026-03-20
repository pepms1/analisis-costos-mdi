import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/index.js";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientOrigin,
    })
  );
  app.use(helmet());
  app.use(express.json());
  app.use(morgan("dev"));

  app.use("/api", routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
