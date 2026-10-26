import dotenv from 'dotenv';
import { createServer } from 'http';

import { createApp } from './app';
import { ws } from './utils/websocket';
import { runDueBackupSchedules } from './utils/backupRunner';
import { syncDueIcalFeeds } from './utils/icalRunner';
import { runDueDigests } from './utils/digestRunner';

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

  // Scheduled runners — backup schedules every 60s; iCal feed syncs and
  // daily digests are throttled so each tick stays cheap.
  let lastIcalTick = 0;
  let lastDigestTick = 0;
  const schedulerTick = () => {
    runDueBackupSchedules().catch((error) => {
      console.error('[backup] Scheduled backup check failed:', error);
    });
    if (Date.now() - lastIcalTick >= 5 * 60 * 1000) {
      lastIcalTick = Date.now();
      syncDueIcalFeeds().catch((error) => {
        console.error('[ical] Feed sync check failed:', error);
      });
    }
    if (Date.now() - lastDigestTick >= 30 * 60 * 1000) {
      lastDigestTick = Date.now();
      runDueDigests().catch((error) => {
        console.error('[digest] Digest check failed:', error);
      });
    }
  };
  setInterval(schedulerTick, 60 * 1000).unref();
  setTimeout(schedulerTick, 15 * 1000).unref();
}
