#!/bin/bash

# SikumAI Railway Deployment Script
# This script helps deploy the SikumAI application to Railway

set -e

echo "🚀 Starting SikumAI Railway Deployment"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed. Please install it first:"
    echo "npm install -g @railway/cli"
    exit 1
fi

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Please login to Railway first:"
    echo "railway login"
    exit 1
fi

# Check if we're in a Railway project
if ! railway status &> /dev/null; then
    echo "🔧 Linking to Railway project..."
    railway link
fi

echo "✅ Railway CLI is ready"

# Set environment variables
echo "🔧 Setting up environment variables..."

# Backend environment variables
railway variables set FLASK_ENV=production --service backend
railway variables set FLASK_DEBUG=False --service backend
railway variables set PYTHONUNBUFFERED=1 --service backend

# Frontend environment variables  
railway variables set NODE_ENV=production --service frontend

echo "✅ Environment variables configured"

# Deploy services
echo "🚀 Deploying backend service..."
railway up --service backend

echo "🚀 Deploying frontend service..."
railway up --service frontend

echo "🚀 Deploying Redis service..."
railway up --service redis

echo "✅ All services deployed successfully!"

# Get service URLs
echo "📋 Service URLs:"
echo "Backend: $(railway url --service backend)"
echo "Frontend: $(railway url --service frontend)"

echo "🎉 Deployment completed successfully!"
echo "📝 Don't forget to:"
echo "   1. Set up your Supabase credentials in Railway dashboard"
echo "   2. Set up your Gemini API key"
echo "   3. Configure LemonSqueezy webhook secrets"
echo "   4. Update your frontend API URL to point to the backend service" 