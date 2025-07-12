FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --force

# Copy the rest of the app
COPY . .

# Generate web build
RUN npm run build:web

# Install serve to run the static files
RUN npm install -g serve

# Expose port (Railway will override this with $PORT)
EXPOSE 3000

# Copy and make the startup script executable
COPY start.sh .
RUN chmod +x start.sh

# Set the command to use our startup script
CMD ["./start.sh"] 