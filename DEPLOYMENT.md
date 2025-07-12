# SikumAI Railway Deployment Guide

This guide will help you deploy SikumAI directly from your GitHub repository to Railway with a unified deployment structure.

## 🚀 Railway Deployment (Recommended)

Railway deployment has been streamlined to run all services from a single GitHub repository. This setup includes:

- **Backend Service**: Python/Flask API
- **Frontend Service**: React Native Web build
- **Redis Service**: For rate limiting and caching

### Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Your SikumAI repository should be on GitHub
3. **Railway CLI**: Install globally with `npm install -g @railway/cli`

### Step 1: Prepare Your Repository

Make sure your repository is updated and pushed to GitHub:

```bash
git add .
git commit -m "Update for Railway deployment"
git push origin main
```

### Step 2: Create Railway Services

#### Option A: Using Railway CLI (Recommended)

1. **Login to Railway**:
   ```bash
   railway login
   ```

2. **Create a New Project**:
   ```bash
   railway new
   ```

3. **Deploy Backend Service**:
   ```bash
   # Navigate to backend directory
   cd backend
   
   # Create backend service
   railway up
   
   # Set environment variables
   railway variables set FLASK_ENV=production
   railway variables set FLASK_DEBUG=False
   railway variables set PYTHONUNBUFFERED=1
   railway variables set SUPABASE_URL=your_supabase_url
   railway variables set SUPABASE_KEY=your_supabase_service_key
   railway variables set GEMINI_API_KEY=your_gemini_api_key
   railway variables set LEMONSQUEEZY_SIGNING_SECRET=your_lemonsqueezy_secret
   ```

4. **Deploy Frontend Service**:
   ```bash
   # Navigate to frontend directory
   cd ../frontend
   
   # Create frontend service
   railway up
   
   # Set environment variables
   railway variables set NODE_ENV=production
   railway variables set EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   railway variables set EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   railway variables set EXPO_PUBLIC_API_URL=https://your-backend-url.railway.app
   ```

5. **Add Redis Service**:
   ```bash
   # Add Redis from Railway's template
   railway add redis
   
   # Get Redis URL and update backend
   railway variables set REDIS_URL=redis://default:password@redis:6379 --service backend
   ```

#### Option B: Using Railway Dashboard

1. **Create New Project** from your GitHub repository
2. **Add Services**:
   - Backend: Point to `/backend` directory
   - Frontend: Point to `/frontend` directory
   - Redis: Use Railway's Redis template

3. **Configure Environment Variables** in each service dashboard

### Step 3: Configure Environment Variables

#### Backend Service Variables
```
FLASK_ENV=production
FLASK_DEBUG=False
PYTHONUNBUFFERED=1
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_google_gemini_api_key
LEMONSQUEEZY_SIGNING_SECRET=your_lemonsqueezy_webhook_secret
REDIS_URL=redis://default:password@redis:6379
```

#### Frontend Service Variables
```
NODE_ENV=production
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=https://your-backend-service.railway.app
EXPO_PUBLIC_SITE_URL=https://your-frontend-service.railway.app
```

### Step 4: Deploy Using Scripts

Use the provided deployment scripts for automated deployment:

#### For Linux/macOS:
```bash
./deploy-railway.sh
```

#### For Windows:
```powershell
.\deploy-railway.ps1
```

### Step 5: Verify Deployment

1. **Check Service Status**:
   ```bash
   railway status
   ```

2. **View Logs**:
   ```bash
   railway logs --service backend
   railway logs --service frontend
   ```

3. **Test Endpoints**:
   - Backend: `https://your-backend-service.railway.app/health`
   - Frontend: `https://your-frontend-service.railway.app`

## 🔧 Configuration Files

### Backend Configuration

- **`nixpacks.toml`**: Nixpacks configuration for Python builds
- **`railway.json`**: Railway deployment configuration
- **`Dockerfile`**: Container configuration (optional)

### Frontend Configuration

- **`railway.json`**: Railway deployment configuration
- **`Dockerfile`**: Container configuration for web builds

## 🐳 Local Development with Docker

For local development, use Docker Compose:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🔧 Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check `railway logs` for detailed error messages
   - Verify all environment variables are set correctly

2. **Service Communication**:
   - Ensure frontend `EXPO_PUBLIC_API_URL` points to backend service
   - Check Redis connection string

3. **Database Issues**:
   - Verify Supabase credentials
   - Check Supabase service role permissions

### Debug Commands

```bash
# Check service status
railway status

# View environment variables
railway variables

# View logs
railway logs --service backend --tail

# Connect to service shell
railway shell --service backend
```

## 📊 Monitoring & Scaling

### Resource Monitoring

Monitor your services in the Railway dashboard:
- CPU usage
- Memory consumption
- Request metrics
- Error rates

### Scaling

Railway automatically scales based on traffic, but you can configure:
- Replica count
- Resource limits
- Auto-scaling policies

## 🔄 Continuous Deployment

Railway automatically deploys when you push to your main branch. To set up:

1. **Connect GitHub**: Link your repository in Railway dashboard
2. **Configure Auto-Deploy**: Enable automatic deployments
3. **Branch Protection**: Use production branch for deployments

## 📝 Environment Variables Reference

### Required Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | Backend | Your Supabase project URL |
| `SUPABASE_KEY` | Backend | Supabase service role key |
| `GEMINI_API_KEY` | Backend | Google Gemini API key |
| `REDIS_URL` | Backend | Redis connection string |
| `EXPO_PUBLIC_SUPABASE_URL` | Frontend | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Supabase anonymous key |
| `EXPO_PUBLIC_API_URL` | Frontend | Backend service URL |

### Optional Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `LEMONSQUEEZY_SIGNING_SECRET` | Backend | Payment webhook secret |
| `EXPO_PUBLIC_SITE_URL` | Frontend | Frontend service URL |
| `FLASK_ENV` | Backend | Flask environment |

## 🚨 Security Considerations

1. **Environment Variables**: Never commit sensitive data to git
2. **Service Keys**: Use service role keys for backend, anon keys for frontend
3. **Webhook Secrets**: Verify webhook signatures
4. **CORS**: Configure proper CORS settings for production

## 📞 Support

If you encounter issues:

1. Check Railway documentation: [docs.railway.app](https://docs.railway.app)
2. Review logs: `railway logs --service <service-name>`
3. Contact Railway support through their dashboard

---

**Happy Deploying! 🚀** 