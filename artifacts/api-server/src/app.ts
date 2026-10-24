import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

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
app.use(cookieParser());

// Backend API
app.use("/api", router);

// Locate frontend build directory across monorepo layouts
const baseDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
const candidates = [
  path.resolve(baseDir, "../../study-companion/dist/public"),
  path.resolve(baseDir, "../../study-companion/dist"),
  path.resolve(process.cwd(), "../study-companion/dist/public"),
  path.resolve(process.cwd(), "../study-companion/dist"),
  path.resolve(process.cwd(), "artifacts/study-companion/dist/public"),
  path.resolve(process.cwd(), "artifacts/study-companion/dist"),
  path.resolve(process.cwd(), "dist/public"),
  path.resolve(process.cwd(), "dist"),
];

const clientDist =
  candidates.find((dir) => fs.existsSync(path.join(dir, "index.html"))) ||
  candidates[0];

app.use(express.static(clientDist));

// Catch-all handler for SPA (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }
  const indexHtml = path.join(clientDist, "index.html");
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).send(`Frontend assets not found. Checked: ${clientDist}`);
  }
});

export default app;
