FROM node:18-alpine

WORKDIR /app

# Set environment variables with defaults
ENV NODE_ENV=production
ENV EXPO_PUBLIC_API_URL=https://sikumai-production.up.railway.app
ENV EXPO_PUBLIC_SUPABASE_URL=https://ujaafvzorxllabjtixip.supabase.co
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqYWFmdnpvcnhsbGFianRpeGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0MTU0MDgsImV4cCI6MjA1NTk5MTQwOH0.vaaMirlhfeojVTeXSWHBW18OhobBRcNHRVFX5olOVFY
ENV EXPO_PUBLIC_SITE_URL=https://sikumai.com

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --force

# Install global dependencies
RUN npm install -g @expo/cli serve

# Copy the rest of the app
COPY . .

# Create web-build directory
RUN mkdir -p web-build

# Try expo export first (with timeout)
RUN echo "=== Attempting Expo Export ===" && \
    timeout 300 npx expo export --platform web --output-dir web-build || \
    echo "Expo export failed or timed out"

# If expo export didn't work, try npm build
RUN if [ ! -f "web-build/index.html" ]; then \
      echo "=== Trying npm build ===" && \
      npm run build:web || echo "npm build failed"; \
    fi

# If still no index.html, create a basic one with public assets
RUN if [ ! -f "web-build/index.html" ]; then \
      echo "=== Creating fallback build ===" && \
      cp -r public/* web-build/ 2>/dev/null || echo "No public folder" && \
      echo '<!DOCTYPE html><html><head><title>SikumAI</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"><h1>SikumAI</h1><p>Initializing application...</p></div></body></html>' > web-build/index.html; \
    fi

# Always copy public assets
RUN cp -r public/* web-build/ 2>/dev/null || echo "No public assets to copy"

# Show what we built
RUN echo "=== Build Results ===" && \
    ls -la web-build/ && \
    echo "=== Index.html exists: ===" && \
    ls -la web-build/index.html

# Expose port (Railway will override this with $PORT)
EXPOSE 3000

# Copy and make the startup script executable
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Start the server
CMD ["/bin/sh", "-c", "/app/start.sh || serve -s web-build -l ${PORT:-3000}"] 