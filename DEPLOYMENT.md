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

## Alternative Backend Deployment Options

Since Firebase Functions might have limitations for Express apps with PostgreSQL, consider these alternatives:

### Option 1: Railway (Recommended)

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

### Option 3: Vercel

1. Sign up at https://vercel.com/
2. Import GitHub repository
3. Configure backend as serverless function
4. Add PostgreSQL database (via Vercel Postgres or external)

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

