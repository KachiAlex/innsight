import dotenv from 'dotenv';
import { createServer } from 'http';

import { createApp } from './app';
import { ws } from './utils/websocket';
import { runDueBackupSchedules } from './utils/backupRunner';

dotenv.config();

const PORT = process.env.PORT || 3001;
const isContainerEnvironment = process.env.NODE_ENV === 'production';
const shouldStartServer = process.env.RUN_LOCAL_SERVER === 'true' || isContainerEnvironment;

// Exported for tests (supertest) — the listener only starts under shouldStartServer.
export const app = createApp();

if (shouldStartServer) {
  const httpServer = createServer(app);
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

  ws.initializeServer(httpServer, corsOrigin);

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 Server mode: ${isContainerEnvironment ? 'Container' : 'Local'}`);
    console.log(`🔌 WebSocket enabled on ws://localhost:${PORT}`);
  });

  // Backup schedule runner — checks for due schedules + prunes expired backups
  // every 60s. Runs in-process; idempotent across restarts.
  const backupTick = () => {
    runDueBackupSchedules().catch((error) => {
      console.error('[backup] Scheduled backup check failed:', error);
    });
  };
  setInterval(backupTick, 60 * 1000).unref();
  setTimeout(backupTick, 15 * 1000).unref();
}
