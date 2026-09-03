import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initialAppData } from "./src/defaultData";
import { AppData } from "./src/types";

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Atomic write helper function
function writeDatabaseAtomic(data: AppData) {
  if (data && Array.isArray(data.activityLogs) && data.activityLogs.length > 50) {
    data.activityLogs = data.activityLogs.slice(0, 50);
  }
  const tempPath = `${DB_PATH}.tmp.${Date.now()}`;
  const jsonContent = JSON.stringify(data, null, 2);
  fs.writeFileSync(tempPath, jsonContent, "utf-8");
  fs.renameSync(tempPath, DB_PATH);
}

// Read database helper function
function readDatabase(): AppData {
  if (!fs.existsSync(DB_PATH)) {
    writeDatabaseAtomic(initialAppData);
    return initialAppData;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw) as AppData;
  } catch (err) {
    console.error("Error reading database file, writing default data:", err);
    writeDatabaseAtomic(initialAppData);
    return initialAppData;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/data", (_req, res) => {
    try {
      const data = readDatabase();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to read database" });
    }
  });

  app.post("/api/data", (req, res) => {
    try {
      const newData = req.body as AppData;
      if (!newData || !newData.projects || !newData.settings) {
        res.status(400).json({ error: "Invalid data format" });
        return;
      }
      writeDatabaseAtomic(newData);
      res.json({ success: true, data: newData });
    } catch (error) {
      console.error("Save error:", error);
      res.status(500).json({ error: "Failed to save database" });
    }
  });

  app.post("/api/reset-data", (_req, res) => {
    try {
      writeDatabaseAtomic(initialAppData);
      res.json({ success: true, data: initialAppData });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset database" });
    }
  });

  // Vite middleware in dev mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/data/**', '**/data/db.json', '**/*.tmp*'],
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Struktur Alur] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
