# InnSight PMS Deployment Guide

## Firebase Deployment

This guide covers deploying InnSight PMS to Firebase Hosting (frontend) and Firebase Functions (backend).

## Prerequisites

1. Firebase CLI installed: `npm install -g firebase-tools`
2. Firebase account: https://console.firebase.google.com/
3. Node.js 18+ installed

## Setup Steps

### 1. Initialize Firebase Project

```bash
# Login to Firebase
firebase login

# Initialize Firebase (if not already done)
firebase init

# Select:
# - Hosting: Configure files for Firebase Hosting
# - Functions: Configure a Cloud Functions directory
```

### 2. Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Enter project name: `innsight-pms` (or your preferred name)
4. Enable Google Analytics (optional)
5. Copy the project ID

### 3. Update Firebase Configuration

Update `.firebaserc` with your project ID:

```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

### 4. Environment Variables

#### Frontend Environment Variables

Create `frontend/.env.production`:

```env
VITE_API_URL=https://your-region-your-project-id.cloudfunctions.net/api
```

#### Backend Environment Variables

For Firebase Functions, set environment variables:

```bash
firebase functions:config:set \
  database.url="your-postgresql-connection-string" \
  jwt.secret="your-jwt-secret" \
  jwt.refresh_secret="your-refresh-secret"
```

Or use Firebase Functions environment variables (recommended):

```bash
firebase functions:secrets:set DATABASE_URL
firebase functions:secrets:set JWT_SECRET
firebase functions:secrets:set JWT_REFRESH_SECRET
```

### 5. Database Setup

#### Option A: Use Cloud SQL (PostgreSQL)

1. Go to Google Cloud Console
2. Create a Cloud SQL PostgreSQL instance
3. Get connection string
4. Update environment variables

#### Option B: Use External PostgreSQL (Railway, Supabase, etc.)

1. Set up PostgreSQL database on external service
2. Get connection string
3. Update environment variables

### 6. Build Frontend

```bash
cd frontend
npm install
npm run build
```

### 7. Deploy

#### Deploy Frontend (Hosting)

```bash
firebase deploy --only hosting
```

#### Deploy Backend (Functions)

```bash
firebase deploy --only functions
```

#### Deploy Both

```bash
firebase deploy
```

## Vercel Deployment (Recommended)

This guide covers deploying InnSight PMS to Vercel with both frontend and backend.

### Prerequisites

1. Vercel CLI installed: `npm install -g vercel`
2. Vercel account: https://vercel.com/
3. Node.js 18+ installed
4. PostgreSQL database (Vercel Postgres or external)

### Setup Steps

#### 1. Initialize Vercel Project

```bash
# Login to Vercel
vercel login

# Initialize Vercel (from project root)
vercel

# Select:
# - Link to existing project or create new
# - Confirm project settings
```

#### 2. Configure Environment Variables

In Vercel dashboard (Settings > Environment Variables) or via CLI:

```bash
# Backend variables
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env add JWT_REFRESH_SECRET
vercel env add CORS_ORIGIN

# Frontend variables
vercel env add VITE_API_URL
```

Required environment variables:

```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
CORS_ORIGIN=https://your-frontend-url.vercel.app
VITE_API_URL=https://your-backend-url.vercel.app/api
```

#### 3. Database Setup

##### Option A: Vercel Postgres (Recommended)

1. Go to Vercel dashboard
2. Create new Postgres database
3. Copy connection string
4. Add to environment variables as `DATABASE_URL`

##### Option B: External PostgreSQL (Railway, Supabase, etc.)

1. Set up PostgreSQL database on external service
2. Get connection string
3. Add to environment variables as `DATABASE_URL`

#### 4. Build and Deploy

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Project Structure

The project is configured as a monorepo with:
- `frontend/` - React application (static build)
- `backend/` - Express API (serverless function)

### Vercel Configuration

`vercel.json` at the root defines:
- Frontend build using `@vercel/static-build`
- Backend API function using `@vercel/node`
- Routes to direct `/api/*` to backend and other paths to frontend

### Important Notes

- **WebSocket Support**: Vercel serverless functions do not support WebSockets. The backend's WebSocket functionality will not work in Vercel deployment. Consider using a separate service like Railway or Render for real-time features if needed.
- **File Uploads**: Serverless functions have size limits. For large file uploads, consider using Vercel Blob or external storage.
- **Database Connections**: Use connection pooling for better performance in serverless environments.

### Alternative Backend Deployment Options

If you need WebSocket support or prefer a traditional server deployment:

### Option 1: Railway

1. Sign up at https://railway.app/
2. Create new project
3. Add PostgreSQL database
4. Connect GitHub repository
5. Set environment variables
6. Deploy automatically

### Option 2: Render

1. Sign up at https://render.com/
2. Create new Web Service
3. Connect GitHub repository
4. Set build command: `cd backend && npm install && npm run build`
5. Set start command: `cd backend && npm start`
6. Add PostgreSQL database
7. Set environment variables

### Option 3: Firebase Functions

1. Follow Firebase deployment guide above
2. Note: Firebase Functions have limitations for Express apps with PostgreSQL

## Environment Variables Reference

### Backend Required Variables

```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
PORT=3001
NODE_ENV=production
```

### Frontend Required Variables

```env
VITE_API_URL=https://your-api-url.com/api
```

## Post-Deployment Checklist

- [ ] Database migrations run successfully
- [ ] Environment variables configured
- [ ] API endpoints accessible
- [ ] Frontend can connect to backend
- [ ] File uploads working (check storage configuration)
- [ ] Authentication working
- [ ] CORS configured correctly

## Troubleshooting

### Frontend can't connect to backend

- Check `VITE_API_URL` in frontend environment
- Verify CORS settings in backend
- Check Firebase Functions logs: `firebase functions:log`

### Database connection issues

- Verify `DATABASE_URL` is correct
- Check database is accessible from Firebase Functions
- Ensure IP whitelist includes Firebase Functions IPs

### Build errors

- Ensure Node.js version matches (18+)
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check TypeScript compilation errors

## Monitoring

- Firebase Console: https://console.firebase.google.com/
- Functions Logs: `firebase functions:log`
- Hosting Analytics: Available in Firebase Console

