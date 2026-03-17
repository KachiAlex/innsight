# Deploy Innsight to Vercel (Monorepo Setup)

This guide walks through deploying both frontend and backend to Vercel using a monorepo configuration.

## Prerequisites

- Vercel account (https://vercel.com)
- Project pushed to GitHub (already done ✅)
- Environment variables ready

## Step 1: Connect GitHub Repository to Vercel

1. Go to https://vercel.com/new
2. Click "Continue with GitHub"
3. Select the `innsight` repository
4. Click "Import"

## Step 2: Configure Project Settings

### Environment Variables

Add these environment variables in Vercel project settings:

**Backend Variables:**
- `NODE_ENV`: `production`
- `PORT`: `3001`
- `JWT_SECRET`: (generate a secure random string)
- `JWT_REFRESH_SECRET`: (generate a secure random string)
- `DATABASE_URL`: (your PostgreSQL/Prisma database URL)
- `FIREBASE_PROJECT_ID`: `innsight-2025`
- `FIREBASE_CLIENT_EMAIL`: (from serviceAccount.innsight-2025.json)
- `FIREBASE_PRIVATE_KEY`: (from serviceAccount.innsight-2025.json - include literal \n characters)
- `FIREBASE_PRIVATE_KEY_ID`: (from serviceAccount.innsight-2025.json)
- `FIREBASE_AUTH_URI`: `https://accounts.google.com/o/oauth2/auth`
- `FIREBASE_TOKEN_URI`: `https://oauth2.googleapis.com/token`
- `CORS_ORIGIN`: `https://your-vercel-domain.vercel.app`

**Frontend Variables:**
- `VITE_API_URL`: `https://your-vercel-domain.vercel.app/api`

### Build Settings

- **Framework Preset**: Other
- **Build Command**: 
  ```bash
  cd frontend && npm run build
  ```
- **Output Directory**: `frontend/dist`
- **Install Command**: 
  ```bash
  npm install --legacy-peer-deps
  ```

## Step 3: Important Configuration Notes

### 1. Frontend Build
The frontend requires Node.js 18+ for proper Vite compilation:
- Vercel uses Node.js 18.x by default ✅

### 2. Backend Runtime
Backend runs as Vercel Node.js serverless functions:
- Ensure `backend/package.json` has all dependencies
- The `vercel.json` routes `/api/*` to backend code

### 3. Database Connection
- Your PostgreSQL database must be accessible from Vercel IPs
- Add Vercel IP ranges to your database firewall if needed
- Ensure `DATABASE_URL` in environment variables is correct

### 4. Firebase Service Account
For Firebase credentials, ensure proper escaping:
```
FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Step 4: Deploy

After environment variables are set:

1. Vercel automatically deploys from `main` branch
2. Deployments trigger on every push to GitHub
3. View deployment progress in Vercel dashboard

**Manual Deploy Command:**
```bash
npm install -g vercel
vercel deploy --prod
```

## Step 5: Verify Deployment

### Health Check Backend
```bash
curl https://your-vercel-domain.vercel.app/api/health
```

Expected response:
```json
{ "status": "ok", "timestamp": "2026-03-17T..." }
```

### Access Frontend
Open https://your-vercel-domain.vercel.app in your browser

## Troubleshooting

### Build Fails
Check Vercel logs:
1. Go to Vercel dashboard → Deployments
2. Click failed deployment → View Build Logs
3. Look for error messages

Common issues:
- Missing environment variables → Add in project settings
- Peer dependency conflicts → Already handled with `--legacy-peer-deps`
- Firebase credentials → Verify raw JSON keys are properly escaped

### API Not Responding
1. Check `/api/health` endpoint
2. Verify `CORS_ORIGIN` environment variable matches Vercel domain
3. Check database connection string in `DATABASE_URL`

### Cold Start Issues
Vercel functions may have ~1 second cold start:
- Normal behavior
- Use health checks to warm up if needed

## Rollback

If deployment has issues:
1. Go to Vercel dashboard → Deployments
2. Find the previous working deployment
3. Click "Promote to Production"

## Next Steps

1. **Monitor Logs**: Set up log aggregation (Vercel includes logs)
2. **Set Up CI/CD Alerts**: Configure Vercel deployment notifications
3. **Performance**: Enable Vercel Analytics for frontend monitoring
4. **Custom Domain**: Choose domain in Vercel project settings

## Costs

- **Free Plan**: First 3 deployments/month, 100GB bandwidth
- **Pro**: $20/month for higher limits
- Watch for database costs (PostgreSQL provider)

---

**Deployment Status**: Ready for Vercel ✅
**Last Updated**: March 17, 2026
