# Database Setup Guide for InnSight PMS

## Quick Setup Options

You need a PostgreSQL database. Here are the easiest options:

### Option 1: Supabase (Recommended - Free & Easy)

1. Go to https://supabase.com/
2. Sign up for free
3. Create a new project
4. Go to Settings → Database
5. Copy the "Connection string" (URI format)
   - It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

### Option 2: Railway (Free Tier Available)

1. Go to https://railway.app/
2. Sign up
3. Click "New Project"
4. Click "Provision PostgreSQL"
5. Click on the PostgreSQL service
6. Go to "Variables" tab
7. Copy the `DATABASE_URL` value

### Option 3: Neon (Free Tier Available)

1. Go to https://neon.tech/
2. Sign up
3. Create a new project
4. Copy the connection string from the dashboard

### Option 4: Cloud SQL (Google Cloud - Paid)

1. Go to Google Cloud Console
2. Create a Cloud SQL PostgreSQL instance
3. Get the connection string

## After Getting Your Database URL

Your DATABASE_URL should look like:
```
postgresql://username:password@host:5432/database_name
```

## Next Steps

Once you have your DATABASE_URL, we'll:
1. Set it as a Firebase secret
2. Run database migrations
3. Seed the database (creates admin@insight.com)

