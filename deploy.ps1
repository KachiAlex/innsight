# InnSight PMS Firebase Deployment Script (PowerShell)

Write-Host "🚀 Starting Firebase deployment..." -ForegroundColor Green

# Check if Firebase CLI is installed
try {
    firebase --version | Out-Null
} catch {
    Write-Host "❌ Firebase CLI is not installed. Installing..." -ForegroundColor Yellow
    npm install -g firebase-tools
}

# Build frontend
Write-Host "📦 Building frontend..." -ForegroundColor Cyan
Set-Location frontend
npm install
npm run build
Set-Location ..

# Build backend
Write-Host "📦 Building backend..." -ForegroundColor Cyan
Set-Location backend
npm install
npm run build
npm run prisma:generate
Set-Location ..

# Deploy to Firebase
Write-Host "🚀 Deploying to Firebase..." -ForegroundColor Cyan
firebase deploy

Write-Host "✅ Deployment complete!" -ForegroundColor Green

