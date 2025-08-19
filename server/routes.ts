import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { TONE_TOKEN_CONFIG } from "@shared/schema";
import { db } from "./db";

export async function registerRoutes(app: Express): Promise<Server> {
  // Basic health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "OEC Staking API" });
  });

  // OEC Token configuration
  app.get("/api/oec/config", (req, res) => {
    res.json(TONE_TOKEN_CONFIG);
  });

  // Create HTTP server
  return createServer(app);
}