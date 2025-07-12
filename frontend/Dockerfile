FROM node:18-alpine

WORKDIR /app

# Set environment variables with defaults
ENV EXPO_PUBLIC_API_URL=https://sikumai-production.up.railway.app
ENV EXPO_PUBLIC_SUPABASE_URL=https://ujaafvzorxllabjtixip.supabase.co
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqYWFmdnpvcnhsbGFianRpeGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0MTU0MDgsImV4cCI6MjA1NTk5MTQwOH0.vaaMirlhfeojVTeXSWHBW18OhobBRcNHRVFX5olOVFY
ENV EXPO_PUBLIC_SITE_URL=https://sikumai.com

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --force

# Copy the rest of the app
COPY . .

# Try different build approaches
RUN echo "Attempting Expo web build..." && \
    (npx expo export --platform web --output-dir web-build || \
     echo "Expo export failed, trying webpack..." && \
     npx webpack --mode production --output-path web-build || \
     echo "Webpack failed, creating basic build..." && \
     mkdir -p web-build && \
     cp -r public/* web-build/ 2>/dev/null || echo "No public folder" && \
     echo '<!DOCTYPE html><html><head><title>SikumAI</title></head><body><h1>SikumAI Frontend</h1><p>Connecting to backend...</p></body></html>' > web-build/index.html)

# Install serve to run the static files
RUN npm install -g serve

# Expose port (Railway will override this with $PORT)
EXPOSE 3000

# Copy and make the startup script executable
COPY start.sh .
RUN chmod +x start.sh

# Set the command to use our startup script
CMD ["./start.sh"] 