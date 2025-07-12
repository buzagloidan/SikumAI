# SikumAI Backend

## Memory Optimization

### Current Memory Usage: 699 MB → Target: ~150 MB

#### Key Optimizations Applied:

1. **Lazy Loading**: QuestionGenerator is only instantiated when needed
2. **Minimal Dependencies**: Removed heavy libraries (langchain, unstructured, etc.)
3. **Memory Cleanup**: File content is explicitly deleted after processing
4. **Single AI SDK**: Use only google-generativeai, removed openai

#### Deployment Recommendations:

##### Option 1: Single Service (Current)
- Memory: ~150 MB after optimization
- Pros: Simple deployment
- Cons: Still loads AI models in main process

##### Option 2: Microservices Architecture
```
┌─────────────────┐    ┌─────────────────┐
│   Flask API     │    │ Question Gen    │
│   (50 MB)       │───►│ Service (100MB) │
│                 │    │                 │
└─────────────────┘    └─────────────────┘
```

##### Option 3: Serverless Functions
- Move question generation to separate Lambda/Cloud Function
- Main Flask app: ~50 MB
- Question generation: Triggered on-demand

### Environment Variables Required:
```
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### Installation (Optimized):
```bash
pip install -r requirements.txt
python app.py
```

Expected memory usage after optimization: ~150 MB (down from 699 MB)

This folder contains the backend webhook service for SikumAI, handling LemonSqueezy payment webhooks and subscription management.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
```

2. Activate the virtual environment:
```bash
# On macOS/Linux
source venv/bin/activate

# On Windows
venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Copy the example environment file and update the values:
```bash
cp .env.example .env
```

5. Update the `.env` file with your actual credentials:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase service role key (not the anon key)
- `LEMONSQUEEZY_SIGNING_SECRET`: Your LemonSqueezy webhook signing secret

## Database Setup

Run the SQL commands in `supabase_schema_update.sql` in your Supabase SQL editor to create the necessary tables and functions for subscription management.

## Running the Server

For development:
```bash
flask run --debug
```

For production:
```bash
gunicorn app:app
```

## Webhook Configuration

In your LemonSqueezy dashboard:

1. Go to Settings → Webhooks
2. Create a new webhook
3. Set the URL to `https://your-backend-url.com/webhook/lemonsqueezy`
4. Select the events to listen for:
   - `order_created`
   - `subscription_payment_success`
   - `subscription_cancelled`
   - `subscription_expired`
5. Copy the signing secret and add it to your `.env` file

## Deployment

For production, deploy this service to a platform like Heroku, Render, or Railway, making sure to set all the environment variables. 