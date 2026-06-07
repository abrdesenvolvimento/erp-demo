import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import backupRouter from "../backupEndpoint";
import { initBackupScheduler, getSchedulerStatus, triggerManualBackup } from "../scheduler";
import { initAccountingScheduler, getAccountingSchedulerStatus, runAccountingBatch, updateAccountingSchedule } from "../accountingScheduler";
import { initStockSnapshotJob } from "../jobs/stockSnapshot";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Storage proxy for uploaded assets
  registerStorageProxy(app);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Backup endpoint under /api/backup
  app.use('/api', backupRouter);
  
  // Scheduler endpoints
  app.get('/api/scheduler/status', (req, res) => {
    res.json(getSchedulerStatus());
  });
  
  app.post('/api/scheduler/trigger', async (req, res) => {
    try {
      await triggerManualBackup();
      res.json({ success: true, message: 'Backup triggered' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Accounting scheduler endpoints
  app.get('/api/accounting-scheduler/status', async (req, res) => {
    const status = await getAccountingSchedulerStatus();
    res.json(status);
  });
  
  app.post('/api/accounting-scheduler/trigger', async (req, res) => {
    try {
      const { competenceMonth } = req.body;
      if (!competenceMonth) {
        return res.status(400).json({ success: false, error: 'competenceMonth is required' });
      }
      const result = await runAccountingBatch(competenceMonth, 'manual', 'api');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.post('/api/accounting-scheduler/update-schedule', async (req, res) => {
    try {
      await updateAccountingSchedule();
      const status = await getAccountingSchedulerStatus();
      res.json({ success: true, ...status });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Heartbeat keep-alive endpoint (prevents Cloud Run cold starts)
  app.post('/api/scheduled/keep-alive', (req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  // ==================== PRINT QUEUE ENDPOINTS (for Print Agent polling) ====================
  // These endpoints do NOT require OAuth — the agent authenticates via companyId.
  // The agent polls GET /api/print-jobs/pending every 2s to pick up queued jobs.

  app.get('/api/print-jobs/pending', async (req, res) => {
    try {
      const companyId = parseInt(String(req.query.companyId), 10);
      if (!companyId || isNaN(companyId)) {
        return res.status(400).json({ error: 'companyId is required' });
      }

      const { getDb } = await import('../db');
      const { printJobs } = await import('../../drizzle/schema');
      const { eq, and, lte, inArray } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return res.json({ jobs: [] });

      // Expire stale PENDING jobs older than 5 minutes (avoid reprinting after agent restart)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      await db
        .update(printJobs)
        .set({ status: 'FAILED', error: 'Expired (older than 5 minutes)', processedAt: new Date() })
        .where(
          and(
            eq(printJobs.companyId, companyId),
            eq(printJobs.status, 'PENDING'),
            lte(printJobs.createdAt, fiveMinAgo)
          )
        );

      // Fetch PENDING jobs and mark them PROCESSING atomically
      const pendingJobs = await db
        .select()
        .from(printJobs)
        .where(
          and(
            eq(printJobs.companyId, companyId),
            eq(printJobs.status, 'PENDING')
          )
        )
        .limit(20);

      if (pendingJobs.length === 0) {
        return res.json({ jobs: [] });
      }

      // Mark as PROCESSING
      const jobIds = pendingJobs.map(j => j.id);
      await db
        .update(printJobs)
        .set({ status: 'PROCESSING' })
        .where(inArray(printJobs.id, jobIds));

      // Return jobs with parsed payload
      const jobs = pendingJobs.map(j => ({
        id: j.id,
        type: j.type,
        department: j.department,
        payload: JSON.parse(j.payload),
        createdAt: j.createdAt,
      }));

      res.json({ jobs });
    } catch (error: any) {
      console.error('[PrintQueue] Error fetching pending jobs:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/print-jobs/complete', async (req, res) => {
    try {
      const { jobId, success, error: errorMsg } = req.body;
      if (!jobId) {
        return res.status(400).json({ error: 'jobId is required' });
      }

      const { getDb } = await import('../db');
      const { printJobs } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return res.status(500).json({ error: 'DB unavailable' });

      await db
        .update(printJobs)
        .set({
          status: success ? 'DONE' : 'FAILED',
          processedAt: new Date(),
          error: errorMsg || null,
        })
        .where(eq(printJobs.id, jobId));

      res.json({ ok: true });
    } catch (error: any) {
      console.error('[PrintQueue] Error completing job:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Inicializar schedulers após servidor estar rodando
    initBackupScheduler();
    initAccountingScheduler();
    initStockSnapshotJob();
  });
}

startServer().catch(console.error);
