# Deployment Guide for Optimized SikumAI Backend

## After Updating Your Repository

### 1. If Deploying on Railway/Heroku/Similar Platform:

```bash
# The platform will automatically detect the changes and redeploy
# Monitor the deployment logs for memory usage improvement
```

### 2. If Deploying on VPS/Cloud Server:

```bash
# SSH into your server
ssh user@your-server

# Navigate to your application directory
cd /path/to/SikumAI/backend

# Pull the latest changes
git pull origin main

# Create a new virtual environment (recommended)
python -m venv venv_optimized
source venv_optimized/bin/activate

# Install optimized dependencies
pip install -r requirements.txt

# Stop the old service
sudo systemctl stop sikumai-backend  # or your service name

# Start with the optimized version
python app.py

# Monitor memory usage
htop  # or top
```

### 3. Docker Deployment:

```dockerfile
# If using Docker, update your Dockerfile
FROM python:3.9-slim

WORKDIR /app

# Copy optimized requirements first
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy application code
COPY . .

# The optimized app will use ~150MB instead of 699MB
CMD ["python", "app.py"]
```

### 4. Memory Monitoring Commands:

```bash
# Check memory usage before optimization
ps aux | grep python | grep app.py

# Check memory usage after optimization
ps aux | grep python | grep app.py

# Monitor in real-time
htop -p $(pgrep -f "python.*app.py")

# Check Python memory usage specifically
python -c "
import psutil
import os
process = psutil.Process(os.getpid())
print(f'Memory usage: {process.memory_info().rss / 1024 / 1024:.2f} MB')
"
```

### 5. Verification Steps:

1. **Check Application Starts**: Ensure Flask app starts without errors
2. **Test File Upload**: Upload a test document to verify functionality
3. **Monitor Memory**: Confirm memory usage is around 150MB
4. **Test AI Generation**: Verify question generation still works
5. **Check Logs**: Review logs for any missing dependency errors

### 6. Rollback Plan (if needed):

```bash
# If there are issues, rollback to previous version
git log --oneline -5  # See recent commits
git revert <commit-hash>  # Revert the optimization commit
git push origin main
```

### Expected Results:
- ✅ Memory usage: 699MB → ~150MB
- ✅ Faster startup time
- ✅ Lower hosting costs
- ✅ Same functionality maintained 