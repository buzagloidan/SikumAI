#!/bin/bash

# SikumAI Local Development Setup Script
# This script helps set up the SikumAI application for local development

set -e

echo "🛠️ Setting up SikumAI for Local Development"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Check if Redis is running (optional)
if ! command -v redis-server &> /dev/null; then
    echo "⚠️  Redis is not installed. You may need to install Redis for rate limiting."
    echo "   On macOS: brew install redis"
    echo "   On Ubuntu: sudo apt-get install redis-server"
fi

echo "✅ Prerequisites check completed"

# Setup Frontend
echo "🔧 Setting up Frontend..."
cd frontend

# Install dependencies
echo "📦 Installing frontend dependencies..."
npm install

# Build for web
echo "🏗️ Building web version..."
npm run build:web

echo "✅ Frontend setup completed"

# Setup Backend
cd ../backend
echo "🔧 Setting up Backend..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "🐍 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📦 Installing backend dependencies..."
pip install -r requirements.txt

echo "✅ Backend setup completed"

# Create environment files
cd ..
echo "📝 Creating environment files..."

# Create frontend .env example
cat > frontend/.env.example << EOF
# Expo Configuration
EXPO_PUBLIC_EAS_PROJECT_ID=your_eas_project_id_here
EXPO_PUBLIC_OWNER=your_expo_username_here

# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_SITE_URL=http://localhost:19006

# App Store Configuration
EXPO_PUBLIC_APP_STORE_URL=your_app_store_url_here
EXPO_PUBLIC_FEEDBACK_URL=your_feedback_url_here

# Update Configuration
EXPO_PUBLIC_UPDATE_URL=your_update_url_here
EOF

# Create backend .env example
cat > backend/.env.example << EOF
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_KEY=your_supabase_service_role_key_here

# Payment Webhooks
LEMONSQUEEZY_SIGNING_SECRET=your_lemonsqueezy_webhook_signing_secret

# AI Services
GEMINI_API_KEY=your_google_gemini_api_key

# Redis Configuration (For Rate Limiting & Caching)
REDIS_URL=redis://localhost:6379

# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=True
EOF

echo "✅ Environment files created"

echo "🎉 Local development setup completed!"
echo "📝 Next steps:"
echo "   1. Copy .env.example to .env in both frontend and backend directories"
echo "   2. Fill in your actual credentials in the .env files"
echo "   3. Start Redis server: redis-server"
echo "   4. Start backend: cd backend && source venv/bin/activate && flask run"
echo "   5. Start frontend: cd frontend && npm start" 