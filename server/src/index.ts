/**
 * Aegis Vanguard API server.
 * Copyright (c) Atlas Synapse.
 */

import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import { initDb } from "./db.js";
import scansRouter from "./routes/scans.js";

const PORT = Number(process.env.PORT) || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "aegis-jwt-secret-change-me-in-production";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aegis-admin-2026";
const TOKEN_EXPIRY = "24h";

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : queryToken;
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function main() {
  await initDb();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/login", (req: Request, res: Response) => {
    const { password } = req.body || {};
    if (!password || password !== ADMIN_PASSWORD) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }
    const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.json({ token });
  });

  app.use("/api", authMiddleware);

  app.use("/api/scans", scansRouter);

  if (process.env.NODE_ENV === "production") {
    const serverDir = path.resolve(__dirname, "..");
    const projectRoot = path.resolve(serverDir, "..");
    const clientDist = path.join(projectRoot, "client", "dist");
    app.use(express.static(clientDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path === "/health") return next();
      res.sendFile(path.join(clientDist, "index.html"), (err) => err && next());
    });
  }

  app.listen(PORT, () => {
    console.log(`Aegis Vanguard API listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
