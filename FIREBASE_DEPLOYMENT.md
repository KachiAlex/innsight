# Firebase Deployment - InnSight PMS

## ✅ Setup Complete!

All Firebase configuration files have been created. Follow these steps to deploy:

## Quick Start

### 1. Login to Firebase

Open your terminal and run:

```bash
firebase login
```

This will open a browser window for authentication.

### 2. Initialize Firebase Project

```bash
firebase init
```

**Select:**
- ✅ **Hosting**: Configure files for Firebase Hosting
- ✅ **Functions**: Configure a Cloud Functions directory

**When prompted:**
- **Use an existing project** or create a new one: Choose **Create a new project**
- **Project name**: `innsight-pms` (or your preferred name)
- **Public directory**: `frontend/dist` ✅ (already configured)
- **Single-page app**: **Yes** ✅
- **Functions directory**: `backend` ✅ (already configured)
- **Language**: **JavaScript** (we use compiled TypeScript)
- **ESLint**: **No** (optional)

### 3. Update Project ID

After initialization, update `.firebaserc` with your actual Firebase project ID:

```json
{
  "projects": {
    "default": "your-actual-project-id-here"
  }
}
```

### 4. Set Environment Variables

#### For Backend (Firebase Functions):

```bash
# Set secrets (you'll be prompted to enter values)
firebase functions:secrets:set DATABASE_URL
firebase functions:secrets:set JWT_SECRET
firebase functions:secrets:set JWT_REFRESH_SECRET
```

**Values needed:**
- `DATABASE_URL`: Your PostgreSQL connection string
  - Example: `postgresql://user:password@host:5432/database`
- `JWT_SECRET`: A random secret string for JWT tokens
- `JWT_REFRESH_SECRET`: Another random secret string for refresh tokens

### 5. Install Dependencies

```bash
# Install frontend dependencies
cd frontend
npm install
cd ..

# Install backend dependencies
cd backend
npm install
cd ..
```

### 6. Build and Deploy

#### Option A: Deploy Everything

```bash
npm run deploy
```

#### Option B: Deploy Separately

**Deploy Frontend:**
```bash
npm run deploy:hosting
```

**Deploy Backend:**
```bash
npm run deploy:functions
```

### 7. Get Your URLs

After deployment:

**Frontend URL:**
```bash
firebase hosting:channel:list
```
Or check: `https://your-project-id.web.app`

**Backend API URL:**
```bash
firebase functions:list
```
Or check Firebase Console → Functions → `api` function

### 8. Update Frontend API URL

1. Get your Firebase Functions URL from step 7
2. Create `frontend/.env.production`:

```env
VITE_API_URL=https://your-region-your-project-id.cloudfunctions.net/api
```

3. Rebuild and redeploy frontend:

```bash
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

## Database Setup Options

### Option 1: Supabase (Recommended - Free Tier)

1. Sign up at https://supabase.com/
2. Create new project
3. Go to Settings → Database
4. Copy connection string
5. Use as `DATABASE_URL` secret

### Option 2: Railway (Easy Setup)

1. Sign up at https://railway.app/
2. Create new project → Add PostgreSQL
3. Copy connection string
4. Use as `DATABASE_URL` secret

### Option 3: Cloud SQL (Google Cloud)

1. Go to Google Cloud Console
2. Create Cloud SQL PostgreSQL instance
3. Get connection string
4. Use as `DATABASE_URL` secret

## Run Database Migrations

After setting up database:

```bash
cd backend
npx prisma migrate deploy
```

## Verify Deployment

1. **Frontend**: Visit `https://your-project-id.web.app`
2. **Backend Health Check**: `https://your-region-your-project-id.cloudfunctions.net/api/health`
3. **Check Logs**: `firebase functions:log`

## Files Created

✅ `firebase.json` - Firebase configuration
✅ `.firebaserc` - Firebase project settings
✅ `backend/index.js` - Firebase Functions entry point
✅ `DEPLOYMENT.md` - Detailed deployment guide
✅ `QUICK_DEPLOY.md` - Quick reference
✅ `deploy.sh` / `deploy.ps1` - Deployment scripts

## Important Notes

1. **Backend Limitations**: Firebase Functions have timeout limits (max 540s) and memory limits. For production, consider deploying backend separately to Railway or Render.

2. **File Uploads**: File uploads are stored locally in `backend/uploads/`. For production, consider using Firebase Storage or Cloud Storage.

3. **Environment Variables**: Use Firebase Functions secrets for sensitive data, not `.env` files.

4. **CORS**: Update CORS origin in `backend/src/index.ts` to include your Firebase Hosting URL.

## Troubleshooting

### Build Fails
- Check Node.js version: `node --version` (needs 18+)
- Clear node_modules: `rm -rf node_modules && npm install`
- Check TypeScript errors: `cd backend && npm run build`

### Functions Deploy Fails
- Ensure `backend/dist/index.js` exists (run `npm run build:backend`)
- Check `backend/index.js` exists
- Verify Prisma client is generated: `cd backend && npm run prisma:generate`

### Frontend Can't Connect to Backend
- Verify `VITE_API_URL` is set correctly
- Check CORS settings in backend
- Verify Functions URL is correct

### Database Connection Issues
- Verify `DATABASE_URL` secret is set
- Check database allows connections from Firebase Functions
- For Cloud SQL, enable Cloud SQL Proxy

## Next Steps

1. ✅ Complete Firebase initialization
2. ✅ Set up database
3. ✅ Set environment variables
4. ✅ Deploy
5. ✅ Test the application
6. ✅ Set up custom domain (optional)

## Support

For issues, check:
- Firebase Console: https://console.firebase.google.com/
- Firebase Docs: https://firebase.google.com/docs
- Functions Logs: `firebase functions:log`

