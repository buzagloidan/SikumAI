#!/bin/bash

# Get the port from environment, default to 3000 if not set
PORT=${PORT:-3000}

echo "Starting frontend server on port $PORT"
echo "PORT environment variable: $PORT"
echo "Frontend deployment version: 1.1.0"

# Start the server
serve -s web-build -l $PORT 