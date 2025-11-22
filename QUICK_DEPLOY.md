# Quick Firebase Deployment Guide

## Prerequisites

1. **Firebase Account**: Sign up at https://console.firebase.google.com/
2. **Firebase CLI**: Already installed ✅
3. **Node.js 18+**: Required for Firebase Functions

## Step-by-Step Deployment

### 1. Login to Firebase

```bash
firebase login
```

### 2. Initialize Firebase Project

```bash
firebase init
```

**Select:**
- ✅ Hosting: Configure files for Firebase Hosting
- ✅ Functions: Configure a Cloud Functions directory

**When prompted:**
- Use existing project or create new: **Create a new project**
- Project name: `innsight-pms` (or your preferred name)
- Public directory: `frontend/dist`
- Single-page app: **Yes**
- Functions directory: `backend`
- Language: **JavaScript** (we'll use compiled TypeScript)

### 3. Update Firebase Project ID

Edit `.firebaserc` and replace `innsight-pms` with your actual Firebase project ID:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

### 4. Set Environment Variables

#### Option A: Using Firebase Functions Config (Legacy)

```bash
firebase functions:config:set \
  database.url="your-postgresql-connection-string" \
  jwt.secret="your-jwt-secret" \
  jwt.refresh_secret="your-refresh-secret"
```

#### Option B: Using Firebase Functions Secrets (Recommended)

```bash
# Set secrets (you'll be prompted to enter values)
firebase functions:secrets:set DATABASE_URL
firebase functions:secrets:set JWT_SECRET
firebase functions:secrets:set JWT_REFRESH_SECRET
```

Then update `backend/index.js` to use secrets:

```javascript
const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');

const databaseUrl = defineSecret('DATABASE_URL');
const jwtSecret = defineSecret('JWT_SECRET');
const jwtRefreshSecret = defineSecret('JWT_REFRESH_SECRET');

// Use in your app
process.env.DATABASE_URL = databaseUrl.value();
process.env.JWT_SECRET = jwtSecret.value();
process.env.JWT_REFRESH_SECRET = jwtRefreshSecret.value();
```

### 5. Build and Deploy

#### Quick Deploy (Both Frontend and Backend)

```bash
npm run deploy
```

#### Deploy Only Frontend

```bash
npm run deploy:hosting
```

#### Deploy Only Backend

```bash
npm run deploy:functions
```

### 6. Update Frontend API URL

After deployment, get your Firebase Functions URL:

```bash
firebase functions:config:get
```

Or check Firebase Console → Functions → api function → URL

Update `frontend/.env.production`:

```env
VITE_API_URL=https://your-region-your-project-id.cloudfunctions.net/api
```

Rebuild and redeploy frontend:

```bash
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

## Database Setup

### Option 1: Cloud SQL (PostgreSQL)

1. Go to Google Cloud Console
2. Create Cloud SQL PostgreSQL instance
3. Get connection string
4. Set as `DATABASE_URL` secret

### Option 2: External PostgreSQL (Recommended for Start)

Use services like:
- **Supabase**: https://supabase.com/ (Free tier available)
- **Railway**: https://railway.app/ (Free tier available)
- **Neon**: https://neon.tech/ (Free tier available)

## Post-Deployment

1. **Run Database Migrations**:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

2. **Verify Deployment**:
   - Frontend: `https://your-project-id.web.app`
   - Backend API: `https://your-region-your-project-id.cloudfunctions.net/api/health`

3. **Check Logs**:
   ```bash
   firebase functions:log
   ```

## Troubleshooting

### Build Errors
- Ensure all dependencies are installed: `npm install` in both frontend and backend
- Check TypeScript compilation: `cd backend && npm run build`

### Function Timeout
- Increase timeout in `backend/index.js` (max 540 seconds)

### CORS Issues
- Update CORS origin in `backend/src/index.ts` to include your Firebase Hosting URL

### Database Connection
- Verify `DATABASE_URL` is set correctly
- Check database allows connections from Firebase Functions IPs
- For Cloud SQL, enable Cloud SQL Proxy or use private IP

## Alternative: Deploy Backend Separately

Since Firebase Functions can be expensive and have limitations, consider deploying backend to:

- **Railway**: https://railway.app/ (Easier setup, better for Express apps)
- **Render**: https://render.com/ (Free tier available)
- **Fly.io**: https://fly.io/ (Good performance)

Then update frontend `VITE_API_URL` to point to your backend URL.

