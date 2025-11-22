# InnSight PMS Setup Guide

## Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL 14+
- Git

## Installation Steps

### 1. Clone and Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup

1. Create a PostgreSQL database:
```bash
createdb innsight_pms
```

2. Copy environment file:
```bash
cd backend
cp .env.example .env
```

3. Update `.env` with your database credentials:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/innsight_pms?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-refresh-secret-key-change-in-production"
```

4. Run database migrations:
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### 3. Create Initial IITECH Admin User

You'll need to create an IITECH admin user manually in the database or via Prisma Studio:

```bash
cd backend
npx prisma studio
```

Or use a seed script (create `backend/prisma/seed.ts`):

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create IITECH tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'IITECH Platform',
      slug: 'iitech',
      email: 'admin@iitech.com',
      subscriptionStatus: 'active',
    },
  });

  // Create IITECH admin user
  const passwordHash = await bcrypt.hash('admin123', 12);
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@iitech.com',
      passwordHash,
      firstName: 'IITECH',
      lastName: 'Admin',
      role: 'iitech_admin',
    },
  });

  console.log('IITECH admin created:', {
    email: 'admin@iitech.com',
    password: 'admin123',
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Add to `backend/package.json`:
```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Run seed:
```bash
npx prisma db seed
```

### 4. Start Development Servers

**Option 1: Run separately**

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

**Option 2: Run from root (if using concurrently)**
```bash
npm run dev
```

### 5. Access the Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- API Health Check: http://localhost:3001/health
- Prisma Studio: `cd backend && npx prisma studio`

## Creating Your First Tenant (Hotel)

1. Login as IITECH admin (admin@iitech.com / admin123)
2. Use the API to create a tenant:

```bash
curl -X POST http://localhost:3001/api/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Grand Hotel",
    "slug": "grand-hotel",
    "email": "info@grandhotel.com",
    "phone": "+2341234567890",
    "ownerEmail": "owner@grandhotel.com",
    "ownerPassword": "password123",
    "ownerFirstName": "John",
    "ownerLastName": "Doe"
  }'
```

3. Login as the tenant owner to start using the PMS

## Project Structure

```
innsight/
├── backend/
│   ├── src/
│   │   ├── routes/          # API route handlers
│   │   ├── middleware/       # Auth, error handling
│   │   ├── utils/           # Utilities (prisma, audit, etc.)
│   │   └── index.ts         # Express app entry
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable components
│   │   ├── store/           # State management
│   │   └── lib/             # API client, utilities
│   └── package.json
├── docs/
│   ├── api.md              # API documentation
│   └── setup.md            # This file
└── README.md
```

## Development Workflow

1. **Database Changes**: Update `backend/prisma/schema.prisma`, then run:
   ```bash
   cd backend
   npx prisma migrate dev --name description
   npx prisma generate
   ```

2. **API Development**: Add routes in `backend/src/routes/`, register in `backend/src/index.ts`

3. **Frontend Development**: Add pages/components in `frontend/src/`

## Testing

Run backend tests:
```bash
cd backend
npm test
```

## Production Build

Build frontend:
```bash
cd frontend
npm run build
```

Build backend:
```bash
cd backend
npm run build
```

## Environment Variables

### Backend (.env)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT tokens
- `JWT_REFRESH_SECRET`: Secret for refresh tokens
- `PORT`: Server port (default: 3001)
- `CORS_ORIGIN`: Frontend URL
- `NODE_ENV`: Environment (development/production)

### Frontend (.env)
- `VITE_API_URL`: Backend API URL (default: /api)

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Ensure database exists

### Migration Issues
- Reset database: `npx prisma migrate reset` (⚠️ deletes all data)
- Check Prisma schema syntax

### Port Already in Use
- Change PORT in backend/.env
- Update frontend vite.config.ts proxy target

## Next Steps

1. Complete frontend UI implementation
2. Add file upload handling for photos
3. Implement payment gateway integrations
4. Add email/SMS notifications
5. Build IoT module (optional)
6. Add comprehensive tests
7. Set up CI/CD pipeline
