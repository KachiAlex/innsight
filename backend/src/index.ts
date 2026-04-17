import dotenv from 'dotenv';
import { createServer } from 'http';

import { createApp } from './app';
import { ws } from './utils/websocket';

dotenv.config();

const PORT = process.env.PORT || 3001;
const isContainerEnvironment = process.env.NODE_ENV === 'production';
const shouldStartServer = process.env.RUN_LOCAL_SERVER === 'true' || isContainerEnvironment;

if (shouldStartServer) {
  const app = createApp();
  const httpServer = createServer(app);
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

  ws.initializeServer(httpServer, corsOrigin);

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 Server mode: ${isContainerEnvironment ? 'Container' : 'Local'}`);
    console.log(`🔌 WebSocket enabled on ws://localhost:${PORT}`);
  });
}
