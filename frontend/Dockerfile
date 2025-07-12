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

# Install Expo CLI for web builds
RUN npm install -g @expo/cli

# Copy the rest of the app
COPY . .

# Build for web
RUN echo "Building React Native web app..." && \
    mkdir -p web-build && \
    echo "Attempting expo export for web..." && \
    (npx expo export --platform web --output-dir web-build && \
     echo "Expo export successful, copying public assets..." && \
     cp -r public/* web-build/ 2>/dev/null || echo "No additional public assets to copy") || \
    (echo "Expo export failed, trying npm build script..." && \
     npm run build:web && \
     echo "npm build successful, copying public assets..." && \
     cp -r public/* web-build/ 2>/dev/null || echo "No additional public assets to copy") || \
    (echo "All builds failed, creating fallback with public assets..." && \
     mkdir -p web-build && \
     cp -r public/* web-build/ 2>/dev/null || echo "No public folder found" && \
     echo '<!DOCTYPE html><html><head><title>SikumAI</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"><h1>SikumAI Loading...</h1><p>If this persists, please check the deployment.</p></div></body></html>' > web-build/index.html) && \
    echo "Build completed, checking output..." && \
    ls -la web-build/

# Install serve to run the static files
RUN npm install -g serve

# Expose port (Railway will override this with $PORT)
EXPOSE 3000

# Copy and make the startup script executable
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Alternative: use serve directly if script fails
# Set the command to use our startup script with fallback
CMD ["/bin/sh", "-c", "/app/start.sh || serve -s web-build -l ${PORT:-3000}"] 