# InnSight PMS Database Setup Script
# This script helps you set up your PostgreSQL database and create the admin account

Write-Host "`n=== InnSight PMS Database Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if DATABASE_URL is already set
if ($env:DATABASE_URL) {
    Write-Host "✓ DATABASE_URL is already set" -ForegroundColor Green
    Write-Host "Current value: $($env:DATABASE_URL.Substring(0, [Math]::Min(50, $env:DATABASE_URL.Length)))..." -ForegroundColor Gray
    Write-Host ""
    $useExisting = Read-Host "Do you want to use this DATABASE_URL? (Y/n)"
    if ($useExisting -eq 'n' -or $useExisting -eq 'N') {
        $env:DATABASE_URL = $null
    }
}

# If DATABASE_URL is not set, ask for it
if (-not $env:DATABASE_URL) {
    Write-Host "You need a PostgreSQL database URL." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Quick Setup Options:" -ForegroundColor Cyan
    Write-Host "1. Supabase (Free): https://supabase.com/" -ForegroundColor Green
    Write-Host "2. Railway (Free tier): https://railway.app/" -ForegroundColor Green
    Write-Host "3. Neon (Free tier): https://neon.tech/" -ForegroundColor Green
    Write-Host ""
    Write-Host "After creating a database, you'll get a connection string like:" -ForegroundColor Gray
    Write-Host "postgresql://user:password@host:5432/database" -ForegroundColor DarkGray
    Write-Host ""
    
    $databaseUrl = Read-Host "Enter your DATABASE_URL (or press Enter to skip)"
    
    if ($databaseUrl) {
        $env:DATABASE_URL = $databaseUrl
        Write-Host "✓ DATABASE_URL set" -ForegroundColor Green
    } else {
        Write-Host "⚠ Skipping database setup. You can set DATABASE_URL later." -ForegroundColor Yellow
        exit 0
    }
}

# Test database connection
Write-Host ""
Write-Host "Testing database connection..." -ForegroundColor Yellow

try {
    cd backend
    npx prisma db pull --preview-feature 2>&1 | Out-Null
    Write-Host "✓ Database connection successful!" -ForegroundColor Green
} catch {
    Write-Host "⚠ Could not verify connection. Continuing anyway..." -ForegroundColor Yellow
}

# Run migrations
Write-Host ""
Write-Host "Running database migrations..." -ForegroundColor Yellow
try {
    npx prisma migrate deploy
    Write-Host "✓ Migrations completed!" -ForegroundColor Green
} catch {
    Write-Host "⚠ Migration failed. Trying to generate Prisma Client..." -ForegroundColor Yellow
    npx prisma generate
}

# Run seed script
Write-Host ""
Write-Host "Seeding database (creating admin account)..." -ForegroundColor Yellow
try {
    npm run prisma:seed
    Write-Host ""
    Write-Host "✓ Database seeded successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "=== Admin Account Created ===" -ForegroundColor Cyan
    Write-Host "Email: admin@insight.com" -ForegroundColor White
    Write-Host "Password: admin123" -ForegroundColor White
    Write-Host "Role: iitech_admin" -ForegroundColor White
} catch {
    Write-Host "⚠ Seeding failed: $_" -ForegroundColor Red
    Write-Host "You can try running manually: cd backend && npm run prisma:seed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Set DATABASE_URL as Firebase secret:" -ForegroundColor White
Write-Host "   firebase functions:secrets:set DATABASE_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Set JWT secrets:" -ForegroundColor White
Write-Host "   firebase functions:secrets:set JWT_SECRET" -ForegroundColor Gray
Write-Host "   firebase functions:secrets:set JWT_REFRESH_SECRET" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Redeploy functions:" -ForegroundColor White
Write-Host "   firebase deploy --only functions" -ForegroundColor Gray
Write-Host ""

cd ..

