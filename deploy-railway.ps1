# SikumAI Railway Deployment Script (PowerShell)
# This script helps deploy the SikumAI application to Railway

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting SikumAI Railway Deployment" -ForegroundColor Green

# Check if Railway CLI is installed
try {
    railway --version | Out-Null
    Write-Host "✅ Railway CLI found" -ForegroundColor Green
}
catch {
    Write-Host "❌ Railway CLI is not installed. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g @railway/cli" -ForegroundColor Yellow
    exit 1
}

# Check if user is logged in
try {
    railway whoami | Out-Null
    Write-Host "✅ User is logged in to Railway" -ForegroundColor Green
}
catch {
    Write-Host "❌ Please login to Railway first:" -ForegroundColor Red
    Write-Host "railway login" -ForegroundColor Yellow
    exit 1
}

# Check if we're in a Railway project
try {
    railway status | Out-Null
    Write-Host "✅ Railway project is linked" -ForegroundColor Green
}
catch {
    Write-Host "🔧 Linking to Railway project..." -ForegroundColor Yellow
    railway link
}

# Set environment variables
Write-Host "🔧 Setting up environment variables..." -ForegroundColor Yellow

# Backend environment variables
railway variables set FLASK_ENV=production --service backend
railway variables set FLASK_DEBUG=False --service backend
railway variables set PYTHONUNBUFFERED=1 --service backend

# Frontend environment variables
railway variables set NODE_ENV=production --service frontend

Write-Host "✅ Environment variables configured" -ForegroundColor Green

# Deploy services
Write-Host "🚀 Deploying backend service..." -ForegroundColor Yellow
railway up --service backend

Write-Host "🚀 Deploying frontend service..." -ForegroundColor Yellow
railway up --service frontend

Write-Host "🚀 Deploying Redis service..." -ForegroundColor Yellow
railway up --service redis

Write-Host "✅ All services deployed successfully!" -ForegroundColor Green

# Get service URLs
Write-Host "📋 Service URLs:" -ForegroundColor Cyan
$backendUrl = railway url --service backend
$frontendUrl = railway url --service frontend

Write-Host "Backend: $backendUrl" -ForegroundColor White
Write-Host "Frontend: $frontendUrl" -ForegroundColor White

Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
Write-Host "📝 Don't forget to:" -ForegroundColor Yellow
Write-Host "   1. Set up your Supabase credentials in Railway dashboard" -ForegroundColor White
Write-Host "   2. Set up your Gemini API key" -ForegroundColor White
Write-Host "   3. Configure LemonSqueezy webhook secrets" -ForegroundColor White
Write-Host "   4. Update your frontend API URL to point to the backend service" -ForegroundColor White 