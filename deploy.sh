#!/bin/bash

# InnSight PMS Firebase Deployment Script

set -e

echo "🚀 Starting Firebase deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Installing..."
    npm install -g firebase-tools
fi

# Check if logged in
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Please login to Firebase..."
    firebase login
fi

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Build backend
echo "📦 Building backend..."
cd backend
npm install
npm run build
npm run prisma:generate
cd ..

# Deploy to Firebase
echo "🚀 Deploying to Firebase..."
firebase deploy

echo "✅ Deployment complete!"
echo "🌐 Your app should be live at: https://$(firebase projects:list | grep -oP 'innsight-pms[^\s]*' | head -1).web.app"

