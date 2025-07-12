# SikumAI
<p align="center">
  <a href="https://sikumai.com/">
    <img src="https://github.com/user-attachments/assets/3b3cc307-df2e-4093-9c9b-3c412e1fc441" width="300"/>
  </a>
</p>

## App Screenshots

<p align="center">
  <img src="https://github.com/user-attachments/assets/71baac08-7f3a-474a-9de0-f87564491ea0" width="19%" alt="Home Screen" />
  <img src="https://github.com/user-attachments/assets/4363b7dc-4d7c-468c-821a-3d8bb235da39" width="19%" alt="Upload Screen" />
  <img src="https://github.com/user-attachments/assets/b6c297b2-ce76-47cd-a765-fba24488b7a7" width="19%" alt="Quiz Screen" />
  <img src="https://github.com/user-attachments/assets/57612396-ba22-409b-bdf7-8688c2da975e" width="19%" alt="Results Screen" />
  <img src="https://github.com/user-attachments/assets/bc9f04c2-61cc-4f46-81eb-7c170002e79e" width="19%" alt="Settings Screen" />
</p>

## Live Demo

Visit [sikumai.com](https://sikumai.com) to see a live demo of the project. The platform is available to everyone and demonstrates the full functionality of the SikumAI application.

## Recent Updates (v1.1.0)

*   **Updated to Expo SDK 53:** Latest stable version with improved performance and new features
*   **Updated Dependencies:** All major dependencies updated to their latest secure versions
*   **Enhanced Security:** Addressed security vulnerabilities in dependencies
*   **Improved Performance:** Updated React Native components and navigation libraries
*   **Flask 3.1.0:** Updated backend to use the latest stable Flask version
*   **AI Integration:** Updated Google Gemini integration to latest API version

## Project Overview

SikumAI is an application designed specifically for Israeli students, transforming their study materials into interactive quizzes. Users can upload various document types, and the application leverages AI to automatically generate relevant questions, creating an engaging and effective learning experience.

The application is available on both iOS (via a React Native build) and the Web.

## User Flow

1.  **Authentication:** Users log in or sign up, managed via Supabase Auth.
2.  **Upload Materials:** Users upload their study documents (PDFs, DOCX, PPTX, etc.) through the app.
3.  **AI Processing:** The Python backend processes the uploaded documents, extracts key information, and uses Google\'s Gemini model to generate quiz questions.
4.  **Take Quiz:** Users interact with the generated quiz through a dedicated interface.
5.  **Manage:** Users can view their quiz history, manage settings, and view subscription status. (Subscription management involves LemonSqueezy).

## Technology Stack

### Frontend (React Native / Expo)

*   **Framework:** React Native (~0.76.7) managed with Expo SDK (~53)
*   **Language:** TypeScript
*   **UI:** React Native core components, Expo modules & components.
*   **Navigation:** React Navigation (`@react-navigation/native`, `@react-navigation/native-stack`)
*   **State Management:** React Context API for session and subscription management
*   **Backend Communication:** Uses `@supabase/supabase-js` for direct interaction with Supabase (Auth, DB) and `fetch` for calls to the custom Python backend API.
*   **Platform:** Runs on iOS and Web. Deployment configurations exist for Railway (backend and frontend).

### Backend (Python / Flask)

*   **Framework:** Flask (~3.1.0) with Gunicorn for production.
*   **Language:** Python
*   **AI/ML:** Direct integration with Google Gemini via the `google-generativeai` library.
*   **Database Interaction:** Supabase (via `supabase-py`).
*   **Document Processing:** Utilizes libraries like `python-docx`, `Pillow`, `PyPDF2`, `python-pptx` to handle various file formats.
*   **Task Queuing/Caching:** Uses Redis (via Flask-Limiter for rate limiting, potentially for other caching).
*   **Payment Webhook Handling:** Supports LemonSqueezy.

## Architecture

The application employs a standard client-server architecture:

*   **Client (Frontend):** A React Native (Expo) application providing the user interface for both iOS and Web platforms. It communicates with Supabase for BaaS features and the Python backend for core AI logic and other operations.
*   **Server (Backend):** A Python Flask API responsible for:
    *   Receiving uploaded documents.
    *   Parsing documents and generating quizzes using Google's Gemini API.
    *   Handling payment webhooks from LemonSqueezy.
    *   Managing user subscriptions.
    *   Storing results/metadata in Supabase.
    *   Rate limiting API requests.

## Key Services

*   **Supabase:** Primary backend-as-a-service provider for Authentication and Database.
*   **Google Cloud / Vertex AI:** Provides the Gemini Large Language Model for quiz generation.
*   **Railway:** Hosting platform for both the frontend (web build) and the backend Python application.
*   **Lemonsqueezy:** Payment provider used for handling subscriptions.
*   **Redis:** Used by the backend for rate limiting (via Railway\'s Redis service or configurable).

## Project Structure

```
sikumai/
├── backend/
│   ├── app.py                # Main Flask application
│   ├── question_generator.py # Handles AI quiz generation
│   ├── requirements.txt      # Python dependencies
│   ├── Procfile              # For Heroku/Railway deployment
│   ├── railway.json          # Railway deployment configuration
│   ├── nixpacks.toml         # Nixpacks configuration for Railway
│   ├── Dockerfile            # Docker configuration for backend
│   ├── .env.example          # Example environment variables
│   └── ...                   # Other Python modules, virtual env (venv)
├── frontend/
│   ├── App.tsx               # Main React Native application component
│   ├── app.config.js         # Expo configuration file
│   ├── supabaseClient.ts     # Supabase client setup
│   ├── package.json          # Node.js dependencies and scripts
│   ├── eas.json              # EAS build configuration
│   ├── Dockerfile            # Docker configuration for frontend
│   ├── railway.json          # Railway deployment configuration
│   ├── screens/              # Application screens
│   ├── components/           # Reusable UI components
│   ├── services/             # API calls, etc.
│   ├── assets/               # Images, fonts
│   ├── .env.example          # Example environment variables
│   └── ...                   # Other TSX/JS files, Expo files (.expo)
├── docker-compose.yml        # Docker Compose for local development
├── deploy-railway.sh         # Railway deployment script (Linux/macOS)
├── deploy-railway.ps1        # Railway deployment script (Windows)
├── setup-local.sh           # Local development setup script
├── DEPLOYMENT.md            # Detailed deployment guide
├── .gitignore
└── README.md                # This file
```

## Environment Variables

For the application to run correctly, you need to set up environment variables for both the frontend and backend. **Do not commit your `.env` files to version control.**

### Frontend (`frontend/.env`)

Create a `.env` file in the `frontend/` directory with the following variables:

Example `frontend/.env.example`:
```env
EXPO_PUBLIC_SUPABASE_URL="your_supabase_url_here"
EXPO_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key_here"
EXPO_PUBLIC_API_URL="your_backend_api_url_here"
```

### Backend (`backend/.env`)

Create a `.env` file in the `backend/` directory:

Example `backend/.env.example`:
```env
# Supabase
SUPABASE_URL="your_supabase_project_url_here"
SUPABASE_KEY="your_supabase_service_role_key_here" # NOT the anon key

# Payment Webhooks
LEMONSQUEEZY_SIGNING_SECRET="your_lemonsqueezy_webhook_signing_secret"

# AI Services
GEMINI_API_KEY="your_google_gemini_api_key" 

# Redis (For Rate Limiting & Caching)
REDIS_URL="your_redis_connection_string_here" # E.g., redis://user:password@host:port

# Flask specific
FLASK_ENV="development" # or "production"
FLASK_DEBUG="True" # or "False"

# Optional: If OpenAI is directly used for other purposes
# OPENAI_API_KEY="your_openai_api_key"
```

## Setup and Installation

### Prerequisites

*   Node.js (latest LTS version recommended) and npm/yarn for the frontend.
*   Python (version 3.8+ recommended) and pip for the backend.
*   Expo CLI: `npm install -g expo-cli`
*   Access to Supabase, Google Cloud (for Gemini API), LemonSqueezy, and a Redis instance.

### Backend Setup

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Create and activate a virtual environment:
    ```bash
    python -m venv venv
    # On macOS/Linux
    source venv/bin/activate
    # On Windows
    venv\\Scripts\\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Create a `.env` file by copying `.env.example` (you need to create this file first, see "Environment Variables" section) and fill in your credentials.
    ```bash
    cp .env.example .env # Create .env.example first!
    # Then edit .env with your actual values
    ```
5.  **Database Setup:** The `backend/README.md` mentions a `supabase_schema_update.sql` file.
    *   **Action Required:** Locate this SQL file. It likely contains schema definitions for tables like `user_subscriptions` and `uploads`. You need to run this SQL in your Supabase SQL editor to set up the necessary database structure. If the file is missing, you may need to recreate it based on the table interactions in `backend/app.py`.

### Frontend Setup

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    # or
    # yarn install
    ```
3.  Create a `.env` file by copying `.env.example` (you need to create this file first, see "Environment Variables" section) and fill in your credentials (taken from `app.config.js` initially).
    ```bash
    cp .env.example .env # Create .env.example first!
    # Then edit .env with your actual values
    ```
4.  **Important:** Modify `frontend/app.config.js` to load the sensitive keys/URLs from the `.env` file (e.g., using a library like `react-native-dotenv` or by ensuring your build process replaces them). Do not keep them hardcoded in `app.config.js`.

## Running the Application

### Quick Start (Local Development)

Use the provided setup script to get started quickly:

```bash
# For Linux/macOS
./setup-local.sh

# For Windows (PowerShell)
.\setup-local.ps1
```

### Manual Setup

#### Backend

1.  Ensure your backend `.env` file is configured and the virtual environment is active.
2.  Start the Flask development server:
    ```bash
    cd backend
    flask run --debug
    ```
    The backend will typically run on `http://127.0.0.1:5000`.

    For production (as per `Procfile` and `backend/README.md`):
    ```bash
    gunicorn app:app
    ```

#### Frontend

1.  Ensure your frontend `.env` file is configured.
2.  Start the Expo development server:
    ```bash
    cd frontend
    npm start
    # or
    # yarn start
    ```
    This will open the Expo developer tools in your browser. You can then:
    *   Run on an iOS simulator (macOS only).
    *   Run on an Android emulator/device.
    *   Run in a web browser.

### Docker Development

For a complete development environment with all services:

```bash
# Start all services (backend, frontend, Redis)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🚀 Deployment

### Railway Deployment (Recommended)

SikumAI is configured for easy deployment on Railway with a unified repository structure:

```bash
# Quick deployment
./deploy-railway.sh

# Or for Windows
.\deploy-railway.ps1
```

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Key Benefits of Railway Deployment:
- **Single Repository**: Deploy all services from one GitHub repo
- **Auto-Scaling**: Automatic scaling based on traffic
- **Integrated Services**: Built-in Redis and database services
- **Environment Management**: Easy environment variable management
- **Continuous Deployment**: Automatic deployments from GitHub

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
