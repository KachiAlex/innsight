# Deploy InnSight PMS to Firebase - Next Steps

## ✅ Current Status

- ✅ Firebase project: `innsight-2025` (active)
- ✅ Firebase CLI: Installed and logged in
- ✅ Project configuration: Updated

## 🚀 Quick Deployment Steps

### Step 1: Build Frontend

```powershell
cd frontend
npm install
npm run build
cd ..
```

### Step 2: Set Environment Variables (Backend)

You need to set these secrets for Firebase Functions:

```powershell
# Set database URL (you'll be prompted to enter the value)
firebase functions:secrets:set DATABASE_URL

# Set JWT secret
firebase functions:secrets:set JWT_SECRET

# Set JWT refresh secret  
firebase functions:secrets:set JWT_REFRESH_SECRET
```

**Values needed:**
- `DATABASE_URL`: Your PostgreSQL connection string
  - Example: `postgresql://user:password@host:5432/database`
  - Get from Supabase, Railway, or Cloud SQL
- `JWT_SECRET`: Random string (e.g., generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `JWT_REFRESH_SECRET`: Another random string

### Step 3: Install Backend Dependencies

```powershell
cd backend
npm install
cd ..
```

### Step 4: Deploy

#### Option A: Deploy Everything

```powershell
npm run deploy
```

#### Option B: Deploy Separately

**Deploy Frontend:**
```powershell
firebase deploy --only hosting
```

**Deploy Backend:**
```powershell
firebase deploy --only functions
```

### Step 5: Get Your URLs

After deployment, get your URLs:

**Frontend URL:**
```powershell
firebase hosting:sites:list
```
Or visit: `https://innsight-2025.web.app`

**Backend API URL:**
```powershell
firebase functions:list
```
Or check Firebase Console → Functions → `api` function

The URL will be something like:
`https://us-central1-innsight-2025.cloudfunctions.net/api`

### Step 6: Update Frontend API URL

1. Create `frontend/.env.production`:

```env
VITE_API_URL=https://your-region-innsight-2025.cloudfunctions.net/api
```

Replace `your-region` with your actual region (e.g., `us-central1`)

2. Rebuild and redeploy frontend:

```powershell
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

## 📊 Database Setup

### Recommended: Supabase (Free Tier)

1. Go to https://supabase.com/
2. Sign up / Login
3. Create new project
4. Go to Settings → Database
5. Copy connection string (Connection Pooling)
6. Use as `DATABASE_URL` secret

### Alternative: Railway

1. Go to https://railway.app/
2. Sign up / Login
3. New Project → Add PostgreSQL
4. Copy connection string
5. Use as `DATABASE_URL` secret

### After Database Setup

Run migrations:

```powershell
cd backend
npx prisma migrate deploy
npx prisma generate
cd ..
```

## ✅ Verification

1. **Frontend**: Visit `https://innsight-2025.web.app`
2. **Backend Health**: `https://your-region-innsight-2025.cloudfunctions.net/api/health`
3. **Check Logs**: `firebase functions:log`

## 🔧 Troubleshooting

### Functions Deploy Fails

- Ensure backend is built: `cd backend && npm run build`
- Check `backend/index.js` exists
- Verify Prisma client: `cd backend && npm run prisma:generate`

### Frontend Can't Connect

- Verify `VITE_API_URL` in `frontend/.env.production`
- Check CORS settings in `backend/src/index.ts`
- Update CORS origin to include: `https://innsight-2025.web.app`

### Database Connection Issues

- Verify `DATABASE_URL` secret is set correctly
- Check database allows external connections
- For Supabase: Use connection pooling URL

## 📝 Next Steps After Deployment

1. ✅ Test login functionality
2. ✅ Create first tenant/admin user
3. ✅ Set up custom domain (optional)
4. ✅ Configure Firebase Storage for file uploads (optional)
5. ✅ Set up monitoring and alerts

## 🎉 You're Ready!

Run these commands in order:

```powershell
# 1. Build frontend
cd frontend; npm install; npm run build; cd ..

# 2. Install backend deps
cd backend; npm install; cd ..

# 3. Set secrets (you'll be prompted)
firebase functions:secrets:set DATABASE_URL
firebase functions:secrets:set JWT_SECRET
firebase functions:secrets:set JWT_REFRESH_SECRET

# 4. Deploy
npm run deploy
```

Good luck! 🚀

