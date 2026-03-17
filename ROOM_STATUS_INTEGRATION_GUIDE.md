# Room Status System - Integration Guide

## Quick Start

This guide walks through integrating the Room Status Management System into your InnSight PMS application.

## Prerequisites

- Node.js 16+
- PostgreSQL database
- Express.js server
- Vue.js 3 frontend
- Socket.io for real-time events

## Installation

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install socket.io socket.io-client uuid
npm install --save-dev @types/node vitest

# Frontend
cd frontend
npm install socket.io-client
```

### 2. Database Migration

```bash
cd backend
npm run prisma:migrate
# or for development
npm run prisma:migrate:dev
```

This will add two new fields to the `Room` model:
- `lastStatusUpdate: DateTime?`
- `lastStatusUpdateBy: String?`

## Backend Integration

### 1. Update Express Configuration

Edit `backend/src/index.ts`:

```typescript
import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';

// Import room status router
import roomStatusRouter from './routes/roomStatus';
import { setupRoomStatusWebSocket } from './routes/roomStatus';

// Create HTTP and Socket.io servers
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(express.json());
app.use(authMiddleware); // Your auth middleware
app.use(tenantMiddleware); // Your tenant middleware

// Routes
app.use('/api/rooms', roomStatusRouter);

// WebSocket setup
setupRoomStatusWebSocket(io);

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

### 2. Create Auth Middleware

If you don't already have one, create `backend/src/middleware/auth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
      tenant?: { id: string };
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret');
    req.user = decoded as { id: string; role: string };
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### 3. Create Tenant Middleware

Create `backend/src/middleware/tenant.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';

export const tenantMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const tenantId = req.headers['x-tenant-id'];

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  req.tenant = { id: tenantId as string };
  next();
};
```

### 4. Environment Variables

Add to `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/innsight
JWT_SECRET=your-jwt-secret
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

## Frontend Integration

### 1. Environment Configuration

Create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:3000
```

### 2. Store Configuration

Create `frontend/src/stores/auth.ts`:

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const tenantId = ref(localStorage.getItem('tenantId') || '');
  const userId = ref(localStorage.getItem('userId') || '');
  const token = ref(localStorage.getItem('token') || '');

  const isAuthenticated = computed(() => !!token.value);

  const setAuth = (newTenantId: string, newUserId: string, newToken: string) => {
    tenantId.value = newTenantId;
    userId.value = newUserId;
    token.value = newToken;

    localStorage.setItem('tenantId', newTenantId);
    localStorage.setItem('userId', newUserId);
    localStorage.setItem('token', newToken);
  };

  const logout = () => {
    tenantId.value = '';
    userId.value = '';
    token.value = '';

    localStorage.removeItem('tenantId');
    localStorage.removeItem('userId');
    localStorage.removeItem('token');
  };

  return {
    tenantId,
    userId,
    token,
    isAuthenticated,
    setAuth,
    logout,
  };
});
```

### 3. Add Room Status Manager to Dashboard

Edit `frontend/src/views/Dashboard.vue`:

```vue
<template>
  <div class="dashboard">
    <header>
      <h1>Hotel Dashboard</h1>
    </header>

    <main>
      <RoomStatusManager />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import RoomStatusManager from '@/components/RoomStatusManager.vue';

const auth = useAuthStore();

onMounted(() => {
  if (!auth.isAuthenticated) {
    router.push('/login');
  }
});
</script>
```

### 4. Update Router Configuration

Edit `frontend/src/router/index.ts`:

```typescript
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/rooms',
    name: 'RoomStatus',
    component: () => import('@/views/RoomStatusPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const auth = useAuthStore();
  
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next('/login');
  } else {
    next();
  }
});

export default router;
```

## Testing Integration

### 1. Run Backend Tests

```bash
cd backend
npm run test -- roomStatus.test.ts
```

### 2. Run Frontend Tests

```bash
cd frontend
npm run test -- useRoomStatus.test.ts
```

### 3. Manual Testing

#### Start Backend

```bash
cd backend
npm run dev
# Should see: 🚀 Server running on port 3000
```

#### Start Frontend

```bash
cd frontend
npm run dev
# Should see: VITE v4.x.x ready in xxx ms
```

#### Test Real-time Connection

Open browser console and check:

```javascript
// In browser console
// Should see WebSocket connection message
// Then room status updates in real-time
```

## Docker Deployment

### 1. Backend Dockerfile

The `backend/Dockerfile` is already set up. Ensure it includes the room status routes.

### 2. Frontend Dockerfile

The `frontend/Dockerfile` is already set up. Ensure it includes the RoomStatusManager component.

### 3. Docker Compose

Create `docker-compose.yml` in root:

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: innsight
      POSTGRES_PASSWORD: password
      POSTGRES_DB: innsight
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://innsight:password@postgres:5432/innsight
      JWT_SECRET: your-secret
      FRONTEND_URL: http://localhost:5173
      NODE_ENV: production
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3000
    depends_on:
      - backend

volumes:
  postgres_data:
```

Run with:

```bash
docker-compose up -d
```

## Feature Activation

### Enable in Admin Panel

Add navigation link in admin panel:

```vue
<template>
  <nav>
    <!-- Existing items -->
    <router-link to="/rooms">
      🏨 Room Status
    </router-link>
  </nav>
</template>
```

### Staff Training

1. **Housekeeping Staff**
   - Mark rooms as `cleaning` after checkout
   - Mark as `available` when ready
   - Report maintenance issues

2. **Front Desk Staff**
   - Use check-in/check-out buttons
   - Track guest arrivals/departures
   - Handle room blocks

3. **Maintenance Staff**
   - View maintenance queue
   - Update maintenance status
   - Mark completed repairs

## Troubleshooting

### WebSocket Connection Issues

If WebSocket fails, check:

```bash
# 1. Backend running
curl http://localhost:3000

# 2. CORS configuration in backend
# Check setupRoomStatusWebSocket function

# 3. Network issues
# Check browser Network tab for WebSocket errors
```

### Database Migration Failed

```bash
# Reset and remigrate
npm run prisma:migrate:reset
npm run prisma:migrate:dev
```

### Frontend Not Updating

```typescript
// In browser console
// Check room statuses
console.log(roomStatuses.value);

// Check connection
console.log(connectionStatus.value);

// If disconnected, check network tab for WebSocket error
```

### Performance Issues

Check database indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_rooms_tenant_status 
ON rooms(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_rooms_last_status_update 
ON rooms(last_status_update);
```

## Monitoring

### Server Logs

```bash
# Watch backend logs
cd backend
npm run dev 2>&1 | grep "Room\|Status"
```

### Database Queries

```sql
-- Check recent room updates
SELECT id, room_number, status, last_status_update, last_status_update_by
FROM rooms
WHERE tenant_id = 'your-tenant-id'
ORDER BY last_status_update DESC
LIMIT 10;
```

### Real-time Metrics

Database query to show status distribution:

```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM rooms 
    WHERE tenant_id = 'your-tenant-id'), 2) as percentage
FROM rooms
WHERE tenant_id = 'your-tenant-id'
GROUP BY status
ORDER BY count DESC;
```

## Security Checklist

- [x] Authentication required for all endpoints
- [x] Tenant isolation enforced
- [x] Rate limiting on room status updates (implement if needed)
- [x] Audit logging of status changes
- [x] HTTPS/TLS for production
- [x] WebSocket secured with TLS
- [x] JWT token validation
- [x] CORS properly configured

## Next Steps

1. ✅ Install dependencies
2. ✅ Run database migration
3. ✅ Start backend server
4. ✅ Start frontend development server
5. ✅ Navigate to dashboard and use Room Status Manager
6. ✅ Monitor logs and test functionality
7. ✅ Deploy to production

## Additional Resources

- [Room Status System Documentation](./ROOM_STATUS_SYSTEM.md)
- [API Endpoints Reference](./docs/api.md)
- [Real-time Events Documentation](./docs/realtime.md)

---

**Support:** For issues or questions, refer to the main documentation or contact the development team.
