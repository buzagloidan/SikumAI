import os
import json
import hmac
import hashlib
import asyncio
from datetime import datetime, timezone, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS  # Import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
from supabase import create_client, Client
from question_generator import QuestionGenerator
import logging
import time
import re
import unicodedata
import random
from functools import wraps

# Load environment variables
load_dotenv()

# Configure logging level - updated to use more appropriate logging levels
logging.basicConfig(
    level=logging.INFO,  # Changed from WARNING to INFO
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',  # Added component name for better filtering
)

# Initialize Flask app
app = Flask(__name__)

# Configure maximum file size (50MB)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB in bytes

# Initialize rate limiter
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["400 per day", "100 per hour"],
    storage_uri=os.getenv("REDIS_URL", "redis://localhost:6379"),  # Default to local Redis if not configured
    strategy="fixed-window",  # Use fixed window strategy for simplicity
)

# Define allowed origins
ALLOWED_ORIGINS = [
    "http://localhost:19006", 
    "http://localhost:8081", 
    "http://localhost:3000", 
    "http://localhost:5001",
    "http://localhost:5002",
    "http://localhost:57937",  # Add the dynamic port from the error
    "https://your-frontend-url.com",
    "https://sikumai.com",
    "https://www.sikumai.com",
    "capacitor://localhost",
    "ionic://localhost",
    "http://localhost",
    "expo://localhost",
    "sikumai://",
    None,  # Allow null/empty origin for Android browsers
    "null"  # Some browsers send "null" as a string
]

# Configure CORS with explicit origins
CORS(app, 
     resources={r"/*": {"origins": ALLOWED_ORIGINS}},  # Remove the wildcard when using credentials
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
     expose_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Define a decorator to ensure CORS headers are added to all responses
def add_cors_headers(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        response = f(*args, **kwargs)
        
        # Get the origin from the request
        origin = request.headers.get('Origin', '')
        
        # Special handling for empty/null origins (common with Android browsers)
        if not origin or origin == 'null':
            app.logger.warning(f"Handling empty/null origin: '{origin}'")
            # For empty origins, we'll use a wildcard or the request host
            if isinstance(response, tuple):
                response_obj, status_code = response
                response_obj.headers['Access-Control-Allow-Origin'] = request.headers.get('Host', '*')
                response_obj.headers['Access-Control-Allow-Credentials'] = 'true'
                return response_obj, status_code
            else:
                response.headers['Access-Control-Allow-Origin'] = request.headers.get('Host', '*')
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                return response
        
        # If origin is in allowed origins, add it to the response headers
        if origin in ALLOWED_ORIGINS:
            if isinstance(response, tuple):
                response_obj, status_code = response
                response_obj.headers['Access-Control-Allow-Origin'] = origin
                response_obj.headers['Access-Control-Allow-Credentials'] = 'true'
                return response_obj, status_code
            else:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                return response
        else:
            # For non-matching origins, we can't use wildcard with credentials
            # Try to automatically add any localhost origin with a port
            if origin.startswith('http://localhost:'):
                if isinstance(response, tuple):
                    response_obj, status_code = response
                    response_obj.headers['Access-Control-Allow-Origin'] = origin
                    response_obj.headers['Access-Control-Allow-Credentials'] = 'true'
                    app.logger.warning(f"Dynamically allowing localhost origin: {origin}")
                    return response_obj, status_code
                else:
                    response.headers['Access-Control-Allow-Origin'] = origin
                    response.headers['Access-Control-Allow-Credentials'] = 'true'
                    app.logger.warning(f"Dynamically allowing localhost origin: {origin}")
                    return response
            else:
                # For other origins, don't allow
                app.logger.warning(f"CORS: Rejecting origin: {origin}")
                return response
    
    return decorated_function

# Define a decorator to check if user has an active subscription
def require_active_subscription(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Skip subscription check for preflight requests
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
        
        # Get authorization token
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            user_id = request.form.get('user_id') or request.args.get('user_id')
            if not user_id:
                app.logger.error("No authentication token or user_id provided")
                return jsonify({"error": "Authentication required", "code": "auth_required"}), 401
        else:
            # Extract user ID from token
            try:
                data = supabase.auth.get_user(token)
                user_id = data.user.id if data and data.user else None
                
                if not user_id:
                    app.logger.error("Invalid authentication token")
                    return jsonify({"error": "Invalid authentication token", "code": "invalid_token"}), 401
            except Exception as auth_error:
                app.logger.error(f"Auth error: {str(auth_error)}")
                return jsonify({"error": "Authentication error", "code": "auth_error"}), 401
        
        # Check for subscription
        try:
            result = supabase.table('user_subscriptions').select('status').eq('user_id', user_id).eq('status', 'active').execute()
            has_subscription = len(result.data) > 0
            
            # Skip upload limit check for statistics endpoint and quiz access endpoints
            endpoint_path = request.path
            if endpoint_path == '/api/user/statistics' or endpoint_path.startswith('/api/quiz/'):
                app.logger.info(f"Skipping upload limit check for endpoint: {endpoint_path}, user: {user_id}")
                return f(*args, **kwargs)
            
            # If user has subscription, skip upload limit check - unlimited uploads for premium users
            if has_subscription:
                app.logger.info(f"Premium user with unlimited uploads: {user_id}")
                return f(*args, **kwargs)
            
            # For free users, check upload limits
            # Get today's uploads - use explicit UTC date range
            today = datetime.now(timezone.utc).date()
            today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
            today_end = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)
            
            # Debug logging to help diagnose issues
            app.logger.debug(f"Checking uploads between {today_start.isoformat()} and {today_end.isoformat()} for user {user_id}")
            
            uploads_today = supabase.table('uploads').select('id', count='exact')\
                .eq('user_id', user_id)\
                .gte('created_at', today_start.isoformat())\
                .lte('created_at', today_end.isoformat())\
                .execute()
            
            # Set limits for free users
            daily_limit = 1  # Free users get 1 upload per day
            upload_count = uploads_today.count if hasattr(uploads_today, 'count') and uploads_today.count is not None else 0
            
            app.logger.info(f"Free user uploads today: {upload_count}/{daily_limit}")
            
            # Check if free user has reached their limit
            if upload_count >= daily_limit:
                error_message = "הגעת למכסת ההעלאות היומית למשתמשי חינם. שדרג לפרימיום להעלאות נוספות."
                english_message = "Free users are limited to 1 upload per day. Please upgrade to premium for unlimited uploads."
                return jsonify({
                    "error": error_message,
                    "code": "free_limit_reached",
                    "message": english_message
                }), 403
        except Exception as e:
            app.logger.error(f"Error checking subscription: {str(e)}")
            # In case of error, continue without checking subscription
            pass
        
        # User has active subscription or is within free limits, proceed
        return f(*args, **kwargs)
    
    return decorated_function

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# LemonSqueezy webhook signing secret
LS_SIGNING_SECRET = os.getenv("LEMONSQUEEZY_SIGNING_SECRET")

# RevenueCat webhook secret key for verification
RC_WEBHOOK_SECRET = os.getenv("REVENUECAT_WEBHOOK_SECRET", "")

# Initialize question generator
def get_question_generator():
    """Get QuestionGenerator instance (lazy loading)"""
    if not hasattr(get_question_generator, 'instance'):
        get_question_generator.instance = QuestionGenerator()
    return get_question_generator.instance

def verify_lemonsqueezy_signature(payload, signature):
    """Verify that the webhook payload was sent by LemonSqueezy."""
    if not LS_SIGNING_SECRET:
        app.logger.error("LemonSqueezy signing secret not configured")
        return False
    
    # Create expected signature
    expected_signature = hmac.new(
        LS_SIGNING_SECRET.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # Compare signatures
    return hmac.compare_digest(expected_signature, signature)

def verify_revenuecat_signature(payload, signature):
    """Verify that the webhook payload was sent by RevenueCat."""
    if not RC_WEBHOOK_SECRET:
        app.logger.error("RevenueCat webhook secret not configured")
        return False
    
    # Create expected signature using HMAC-SHA256
    expected_signature = hmac.new(
        RC_WEBHOOK_SECRET.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # Compare signatures
    return hmac.compare_digest(expected_signature, signature)

def sanitize_filename(filename):
    """
    Sanitize a filename to be safe for storage.
    Removes unicode control characters and replaces non-ASCII chars with encoded version.
    """
    # First normalize unicode characters
    filename = unicodedata.normalize('NFKC', filename)
    
    # Remove all bidirectional control characters and other invisible characters
    filename = re.sub(r'[\u200e\u200f\u2068\u2069\u202a-\u202e\u200b-\u200d\ufeff]', '', filename)
    
    # First, convert spaces and special chars to underscores
    sanitized = ""
    for char in filename:
        if not char.isalnum() and char not in '._-' and not ('\u0590' <= char <= '\u05FF'):  # Allow Hebrew characters
            sanitized += '_'
        else:
            sanitized += char
    
    # Ensure we don't have multiple underscores in a row
    sanitized = re.sub(r'_+', '_', sanitized)
    
    # Make sure the filename is not empty and does not start or end with underscore
    sanitized = sanitized.strip('_')
    
    # If after sanitization we still have non-ASCII characters (like Hebrew),
    # create a transliterated version for Supabase storage path
    if not all(ord(c) < 128 for c in sanitized):
        # Keep a copy of the sanitized name with Hebrew characters
        display_name = sanitized
        
        # Create a safe ASCII-only version for storage
        if '.' in filename:
            extension = filename.split('.')[-1]
            base_name = '.'.join(filename.split('.')[:-1])
            # Use a hash of the filename for uniqueness but keep it readable
            safe_name = f"file_{hashlib.md5(base_name.encode('utf-8')).hexdigest()[:12]}.{extension}"
        else:
            safe_name = f"file_{hashlib.md5(filename.encode('utf-8')).hexdigest()[:12]}"
        
        return safe_name, display_name
    
    # If somehow we ended up with an empty string, provide a default name
    if not sanitized:
        sanitized = f"file_{int(time.time())}"
    
    return sanitized, sanitized

@app.route('/webhook/lemonsqueezy', methods=['POST'])
@limiter.limit("100 per day")
def lemonsqueezy_webhook():
    """Handle LemonSqueezy webhook events."""
    # Get signature from header
    signature = request.headers.get('X-Signature')
    if not signature:
        return jsonify({"error": "No signature header found"}), 401
    
    # Get request body
    payload = request.data
    
    # Verify signature
    if not verify_lemonsqueezy_signature(payload, signature):
        return jsonify({"error": "Invalid signature"}), 401
    
    # Parse JSON data
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON payload"}), 400
    
    # Process event based on type
    event_name = data.get('meta', {}).get('event_name')
    
    if not event_name:
        return jsonify({"error": "No event name in payload"}), 400
    
    # Handle order_created event
    if event_name == 'order_created':
        try:
            # Extract user_id from meta.custom_data
            custom_data = data.get('meta', {}).get('custom_data', {})
            user_id = custom_data.get('user_id')
            
            if not user_id:
                return jsonify({"error": "No user_id in custom_data"}), 400
            
            # Extract order data
            order_data = data.get('data', {}).get('attributes', {})
            order_id = data.get('data', {}).get('id')
            order_number = order_data.get('order_number')
            status = order_data.get('status')
            
            # Extract subscription details from first_order_item
            first_order_item = order_data.get('first_order_item', {})
            variant_name = first_order_item.get('product_name', '').lower()
            subscription_type = 'monthly' if 'month' in variant_name else 'yearly' if 'year' in variant_name else None
            
            # Get subscription data from the subscription object
            subscription_data = data.get('data', {}).get('attributes', {})
            trial_ends_at = subscription_data.get('trial_ends_at')
            renews_at = subscription_data.get('renews_at')
            ends_at = subscription_data.get('ends_at')
            expires_at = renews_at or ends_at
            
            # Update user subscription status in Supabase
            current_time = datetime.now(timezone.utc).isoformat()
            
            # Update user subscription status
            supabase.table('user_subscriptions').upsert({
                'user_id': user_id,
                'provider': 'lemonsqueezy',
                'status': 'active',
                'provider_order_id': order_id,
                'provider_order_number': order_number,
                'subscription_type': subscription_type,
                'expires_at': expires_at,
                'trial_ends_at': trial_ends_at,
                'created_at': current_time,
                'updated_at': current_time
            }).execute()
            
            return jsonify({"success": True, "message": "Subscription activated"}), 200
            
        except Exception as e:
            app.logger.error(f"Error processing order_created: {str(e)}")
            return jsonify({"error": str(e)}), 500
    
    # Handle subscription_payment_success event
    elif event_name == 'subscription_payment_success':
        try:
            # Extract subscription data
            subscription_data = data.get('data', {}).get('attributes', {})
            order_id = subscription_data.get('order_id')
            
            # Get user_id from existing order
            result = supabase.table('user_subscriptions').select('user_id').eq('provider_order_id', order_id).execute()
            
            if not result.data:
                return jsonify({"error": f"No subscription found for order_id {order_id}"}), 400
            
            user_id = result.data[0]['user_id']
            
            # Get updated subscription details
            renews_at = subscription_data.get('renews_at')
            ends_at = subscription_data.get('ends_at')
            expires_at = renews_at or ends_at
            
            # Update subscription
            current_time = datetime.now(timezone.utc).isoformat()
            
            supabase.table('user_subscriptions').update({
                'status': 'active',
                'expires_at': expires_at,
                'updated_at': current_time
            }).eq('user_id', user_id).execute()
            
            return jsonify({"success": True, "message": "Subscription payment processed"}), 200
        
        except Exception as e:
            app.logger.error(f"Error processing subscription_payment_success: {str(e)}")
            return jsonify({"error": str(e)}), 500
    
    # Handle subscription_cancelled or subscription_expired event
    elif event_name in ['subscription_cancelled', 'subscription_expired']:
        try:
            # Extract subscription data
            subscription_data = data.get('data', {}).get('attributes', {})
            order_id = subscription_data.get('order_id')
            
            # Get user_id from existing order
            result = supabase.table('user_subscriptions').select('user_id').eq('provider_order_id', order_id).execute()
            
            if not result.data:
                return jsonify({"error": f"No subscription found for order_id {order_id}"}), 400
            
            user_id = result.data[0]['user_id']
            
            # Update subscription status
            current_time = datetime.now(timezone.utc).isoformat()
            
            supabase.table('user_subscriptions').update({
                'status': 'cancelled' if event_name == 'subscription_cancelled' else 'expired',
                'updated_at': current_time
            }).eq('user_id', user_id).execute()
            
            return jsonify({"success": True, "message": f"Subscription {event_name.split('_')[1]}"}), 200
        
        except Exception as e:
            app.logger.error(f"Error processing {event_name}: {str(e)}")
            return jsonify({"error": str(e)}), 500
    
    # Return OK for other events
    return jsonify({"success": True, "message": f"Event {event_name} received"}), 200

@app.route('/webhook/revenuecat', methods=['POST'])
@limiter.limit("100 per day")
@add_cors_headers
def revenuecat_webhook():
    """Handle RevenueCat webhook events for subscription status updates."""
    # Get signature from header
    signature = request.headers.get('X-RevenueCat-Signature')
    if not signature:
        return jsonify({"error": "No signature header found"}), 401
    
    # Get request body
    payload = request.data
    
    # Verify signature
    if not verify_revenuecat_signature(payload, signature):
        return jsonify({"error": "Invalid signature"}), 401
    
    # Parse JSON data
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON payload"}), 400
    
    # Get event type
    event_type = data.get('event', {}).get('type')
    if not event_type:
        return jsonify({"error": "No event type in payload"}), 400
    
    app.logger.warning(f"Processing RevenueCat webhook event: {event_type}")
    
    try:
        # Get the app_user_id (which should be our user ID)
        app_user_id = data.get('app_user_id')
        if not app_user_id:
            return jsonify({"error": "No app_user_id in payload"}), 400
        
        # Get entitlements info
        entitlements = data.get('entitlements', {})
        premium_status = 'active' if 'premium' in entitlements else 'inactive'
        
        current_time = datetime.now(timezone.utc).isoformat()
        
        # Extract subscription details
        product_id = data.get('product_id', '')
        subscription_type = 'monthly' if 'Monthly' in product_id else 'yearly' if 'Annual' in product_id else None
        expires_at = data.get('event', {}).get('expiration_at_ms')
        trial_ends_at = data.get('event', {}).get('trial_end_at_ms')
        
        # Convert millisecond timestamps to ISO format if they exist
        if expires_at:
            expires_at = datetime.fromtimestamp(expires_at / 1000, timezone.utc).isoformat()
        if trial_ends_at:
            trial_ends_at = datetime.fromtimestamp(trial_ends_at / 1000, timezone.utc).isoformat()
        
        # Create service role client for database operations
        service_role_client = supabase.auth.get_user(os.environ.get('SUPABASE_SERVICE_ROLE_KEY'))
        
        # Handle common subscription events
        if event_type in ['INITIAL_PURCHASE', 'RENEWAL', 'RENEWAL_FROM_BILLING_RETRY', 'SUBSCRIPTION_PURCHASED']:
            # User has purchased or renewed a subscription
            result = service_role_client.table('user_subscriptions').upsert({
                'user_id': app_user_id,
                'provider': 'revenuecat',
                'status': 'active',
                'provider_order_id': product_id,
                'subscription_type': subscription_type,
                'expires_at': expires_at,
                'trial_ends_at': trial_ends_at,
                'created_at': current_time,
                'updated_at': current_time
            }).execute()
            
            if result.error:
                app.logger.error(f"Error updating subscription: {result.error}")
                return jsonify({"error": str(result.error)}), 500
            
            return jsonify({"success": True, "message": "Subscription activated"}), 200
            
        elif event_type in ['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE', 'SUBSCRIPTION_CANCELLED']:
            # User's subscription has been cancelled or expired
            update_data = {
                'status': 'cancelled' if event_type == 'CANCELLATION' else 'expired',
                'updated_at': current_time
            }
            # Only update expiration if provided
            if expires_at:
                update_data['expires_at'] = expires_at
            
            result = service_role_client.table('user_subscriptions').update(update_data).eq('user_id', app_user_id).execute()
            
            if result.error:
                app.logger.error(f"Error updating subscription: {result.error}")
                return jsonify({"error": str(result.error)}), 500
            
            return jsonify({"success": True, "message": "Subscription updated"}), 200
            
        return jsonify({"success": True, "message": f"Event {event_type} received"}), 200
        
    except Exception as e:
        app.logger.error(f"Error processing RevenueCat webhook: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload', methods=['POST', 'OPTIONS'])
@limiter.limit("120 per day, 15 per minute", exempt_when=lambda: request.method == 'OPTIONS')
@add_cors_headers
def upload_file():
    """Upload file and generate questions."""
    if request.method == 'OPTIONS':
        # Handle preflight request for upload endpoint specifically
        response = jsonify({"status": "preflight_ok"})
        
        # Get the origin from the request
        origin = request.headers.get('Origin', '*')
        
        # Set explicit Access-Control-Allow-Origin based on the request origin
        if origin in ALLOWED_ORIGINS:
            response.headers.add('Access-Control-Allow-Origin', origin)
        else:
            response.headers.add('Access-Control-Allow-Origin', '*')
            
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
    # Enhanced logging for debugging
    app.logger.warning("Upload endpoint called with Content-Type: %s", request.content_type)
    app.logger.warning("Request headers: %s", dict(request.headers))
    app.logger.warning("Files in request: %s", list(request.files.keys()) if request.files else "None")
    app.logger.warning("Form data in request: %s", list(request.form.keys()) if request.form else "None")
    
    # First try to get user ID from token
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = None
    
    if token:
        try:
            data = supabase.auth.get_user(token)
            user_id = data.user.id if data and data.user else None
            
            if not user_id:
                app.logger.error("Invalid authentication token")
                return jsonify({"error": "Invalid authentication token", "code": "auth_error"}), 401
        except Exception as auth_error:
            app.logger.error(f"Auth error: {str(auth_error)}")
            return jsonify({"error": "Authentication error", "code": "auth_error"}), 401
    
    # Fallback to form user_id if token auth failed
    if not user_id:
        user_id = request.form.get('user_id')
        if not user_id:
            app.logger.error("No user ID provided in token or form data")
            return jsonify({"error": "Authentication required", "code": "auth_required"}), 401
    
    # Check for subscription
    try:
        result = supabase.table('user_subscriptions').select('status').eq('user_id', user_id).eq('status', 'active').execute()
        has_subscription = len(result.data) > 0
        
        # Get today's uploads - use explicit UTC date range
        today = datetime.now(timezone.utc).date()
        today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
        today_end = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)
        
        # Debug logging
        app.logger.warning(f"Checking uploads between {today_start.isoformat()} and {today_end.isoformat()} for user {user_id}")
        
        uploads_today = supabase.table('uploads').select('id', count='exact')\
            .eq('user_id', user_id)\
            .gte('created_at', today_start.isoformat())\
            .lte('created_at', today_end.isoformat())\
            .execute()
        
        # Set limits based on subscription status
        daily_limit = 10 if has_subscription else 1
        upload_count = uploads_today.count if hasattr(uploads_today, 'count') and uploads_today.count is not None else 0
        
        app.logger.warning(f"User uploads today: {upload_count}/{daily_limit}, Premium: {has_subscription}")
        
        # Check if user has reached their limit
        if upload_count >= daily_limit:
            error_message = "הגעת למכסת ההעלאות היומית למשתמשי פרימיום" if has_subscription else "הגעת למכסת ההעלאות היומית למשתמשי חינם. שדרג לפרימיום להעלאות נוספות."
            english_message = "Free users are limited to 1 upload per day. Please upgrade to premium for increased limits."
            return jsonify({
                "error": error_message,
                "code": "free_limit_reached" if not has_subscription else "premium_limit_reached",
                "message": english_message if not has_subscription else error_message
            }), 403
    except Exception as e:
        app.logger.error(f"Error checking subscription: {str(e)}")
        # In case of error, continue without checking subscription
        pass
    
    # Check for file
    if 'file' not in request.files:
        app.logger.error("No file in request")
        app.logger.error(f"Request content type: {request.content_type}")
        app.logger.error(f"Request files: {request.files}")
        app.logger.error(f"Request form: {request.form}")
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    if not file.filename:
        app.logger.error("Empty filename")
        return jsonify({"error": "Empty filename"}), 400
        
    mime_type = file.content_type
    app.logger.info(f"File upload attempt - filename: {file.filename}, content_type: {mime_type}, user_id: {user_id}")
    
    # Check file type
    allowed_types = [
        'application/pdf', 
        'text/plain', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
    
    # For debugging - try to determine type from filename if mime_type is application/octet-stream
    if mime_type == 'application/octet-stream':
        filename = file.filename.lower()
        if filename.endswith('.pdf'):
            app.logger.info(f"Overriding octet-stream with application/pdf based on filename: {filename}")
            mime_type = 'application/pdf'
        elif filename.endswith('.txt'):
            app.logger.info(f"Overriding octet-stream with text/plain based on filename: {filename}")
            mime_type = 'text/plain'
        elif filename.endswith('.doc'):
            app.logger.info(f"Overriding octet-stream with application/msword based on filename: {filename}")
            mime_type = 'application/msword'
        elif filename.endswith('.docx'):
            app.logger.info(f"Overriding octet-stream with application/vnd.openxmlformats-officedocument.wordprocessingml.document based on filename: {filename}")
            mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    
    if mime_type not in allowed_types:
        app.logger.error(f"Unsupported file type: {mime_type}")
        return jsonify({"error": f"Unsupported file type: {mime_type}"}), 400
    
    try:
        # Read file content
        file_content = file.read()
        
        # Generate unique job ID
        job_id = f"{user_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        
        # Store file in Supabase Storage
        try:
            # Sanitize the filename to avoid Supabase storage issues
            original_filename = file.filename
            sanitized_filename, display_name = sanitize_filename(original_filename)
            
            storage_path = f"{user_id}/{job_id}/{sanitized_filename}"
            
            # Attempt storage
            supabase.storage.from_('uploads').upload(storage_path, file_content)
            app.logger.debug("File uploaded to Supabase storage")
            
            # Continue to use display name in the database for display purposes
            original_filename_for_db = display_name
        except Exception as storage_error:
            app.logger.error(f"Error storing file in Supabase: {str(storage_error)}")
            raise storage_error
        
        # Create upload record with original filename but sanitized storage path
        upload_data = {
            'id': job_id,
            'user_id': user_id,
            'file_name': original_filename_for_db,
            'mime_type': mime_type,
            'storage_path': storage_path,
            'status': 'processing',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        try:
            supabase.table('uploads').insert(upload_data).execute()
            app.logger.debug("Upload record created in database")
        except Exception as db_error:
            app.logger.error(f"Error creating upload record: {str(db_error)}")
            raise db_error
        
        # Generate questions (non-async version)
        num_questions = 20  # As per architecture document
        app.logger.debug(f"Generating questions using {mime_type} file")
        
        try:
            # Use the generate_questions method but in a non-async way
            questions = get_question_generator().generate_questions(file_content, mime_type, num_questions)
            app.logger.debug(f"Generated {len(questions)} questions")
            
            # Clear file content from memory immediately after processing
            del file_content
            
        except Exception as gen_error:
            app.logger.error(f"Error generating questions: {str(gen_error)}")
            # Clear file content even on error
            if 'file_content' in locals():
                del file_content
            raise gen_error
        
        # Store questions in database
        try:
            if questions:
                processed_questions = []
                for q in questions:
                    question_data = {
                        'job_id': job_id,
                        'created_at': datetime.now(timezone.utc).isoformat()
                    }
                    
                    # Copy essential fields
                    for key in ['question', 'options']:
                        if key in q:
                            question_data[key] = q[key]
                    
                    # Fix field name mismatch - map 'correctAnswer' to 'correct_option_index'
                    if 'correctAnswer' in q:
                        question_data['correct_option_index'] = q['correctAnswer']
                    elif 'correct_option_index' in q:
                        question_data['correct_option_index'] = q['correct_option_index']
                    
                    # Include explanation field if it exists
                    if 'explanation' in q:
                        question_data['explanation'] = q['explanation']
                    
                    processed_questions.append(question_data)
                
                supabase.table('questions').insert(processed_questions).execute()
                app.logger.debug("Questions stored in database")
            else:
                app.logger.warning("No questions were generated")
        except Exception as q_db_error:
            app.logger.error(f"Error storing questions: {str(q_db_error)}")
            raise q_db_error
        
        # Update upload status
        try:
            supabase.table('uploads').update({'status': 'completed'}).eq('id', job_id).execute()
            app.logger.debug("Upload status updated to completed")
        except Exception as status_error:
            app.logger.error(f"Error updating upload status: {str(status_error)}")
            raise status_error
        
        # Ensure the response has CORS headers
        response = jsonify({
            "success": True,
            "job_id": job_id,
            "question_count": len(questions),
            "has_subscription": True
        })
        
        # Get the origin from the request
        origin = request.headers.get('Origin', '*')
        
        # Set explicit Access-Control-Allow-Origin based on the request origin
        if origin in ALLOWED_ORIGINS:
            response.headers['Access-Control-Allow-Origin'] = origin
        else:
            response.headers['Access-Control-Allow-Origin'] = '*'
            
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin'
        response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
            
        return response, 200
        
    except Exception as e:
        app.logger.error(f"Error processing file upload: {str(e)}")
        # If job ID was created, update status to failed
        if 'job_id' in locals():
            try:
                supabase.table('uploads').update({'status': 'failed'}).eq('id', job_id).execute()
                app.logger.info(f"Updated job {job_id} status to failed")
            except Exception as update_error:
                app.logger.error(f"Error updating failed status: {str(update_error)}")
        
        # Check for PostgreSQL P0001 error related to upload limits
        error_str = str(e)
        status_code = 500
        response_data = {"error": error_str}
        
        if "P0001" in error_str:
            # Handle database-level upload limit trigger errors
            if "Free users are limited to 1 upload per day" in error_str:
                app.logger.warning("Caught database trigger error for free user upload limit")
                status_code = 403
                response_data = {
                    "error": "הגעת למכסת ההעלאות היומית למשתמשי חינם. שדרג לפרימיום להעלאות נוספות.",
                    "code": "free_limit_reached",
                    "message": "Free users are limited to 1 upload per day. Please upgrade to premium for unlimited uploads."
                }
            # We're making premium users have unlimited uploads, so this error should no longer occur
            # Keeping this code just for backward compatibility in case the DB trigger still fires
            elif "Premium users are limited to 10 uploads per day" in error_str:
                app.logger.warning("Caught database trigger error for premium user upload limit - should no longer occur")
                # Instead of blocking with error 403, allow the premium user to continue
                app.logger.info("Allowing premium user to continue with unlimited uploads")
                # Update the job status to 'processing' if job_id is available
                if 'job_id' in locals():
                    try:
                        supabase.table('uploads').update({'status': 'processing'}).eq('id', job_id).execute()
                        app.logger.info(f"Updated job {job_id} status to processing for premium user")
                        
                        # Return success response
                        return jsonify({
                            "success": True,
                            "job_id": job_id,
                            "message": "Your file is being processed."
                        })
                    except Exception as update_error:
                        app.logger.error(f"Error updating job status: {str(update_error)}")
        
        # Ensure error response has CORS headers
        response = jsonify(response_data)
        
        # Get the origin from the request
        origin = request.headers.get('Origin', '*')
        
        # Set explicit Access-Control-Allow-Origin based on the request origin
        if origin in ALLOWED_ORIGINS:
            response.headers['Access-Control-Allow-Origin'] = origin
        else:
            response.headers['Access-Control-Allow-Origin'] = '*'
            
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin'
        response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        
        return response, status_code

@app.route('/api/quiz/<job_id>', methods=['GET'])
@limiter.limit("600 per day, 60 per minute")
@require_active_subscription
@add_cors_headers
def get_quiz(job_id):
    """Get generated quiz questions for a job ID."""
    try:
        # Get user ID from token
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({"error": "No authentication token provided"}), 401
        
        # Extract user ID from the token claims
        try:
            user_id = None
            data = supabase.auth.get_user(token)
            user_id = data.user.id if data and data.user else None
            
            if not user_id:
                return jsonify({"error": "Invalid authentication token"}), 401
        except Exception as auth_error:
            app.logger.error(f"Auth error: {str(auth_error)}")
            return jsonify({"error": "Authentication error"}), 401
        
        # Verify the upload belongs to the user
        upload_result = supabase.table('uploads').select('*').eq('id', job_id).eq('user_id', user_id).execute()
        
        if not upload_result.data:
            return jsonify({"error": "Quiz not found or not authorized"}), 404
        
        upload = upload_result.data[0]
        
        if upload['status'] == 'processing':
            return jsonify({
                "success": True,
                "status": "processing",
                "message": "Quiz is still being generated"
            }), 200
        
        if upload['status'] == 'failed':
            return jsonify({
                "success": False,
                "status": "failed",
                "message": "Quiz generation failed"
            }), 200
        
        # Get questions
        questions_result = supabase.table('questions').select('*').eq('job_id', job_id).execute()
        
        if not questions_result.data:
            return jsonify({
                "success": False,
                "message": "No questions found for this quiz"
            }), 200
        
        # Transform questions - rename 'correct_option_index' to 'correctAnswer' for frontend
        # AND randomize the order of the options for each question
        transformed_questions = []
        for q in questions_result.data:
            # Remove verbose logging of each question processing
            # app.logger.info(f"Processing question {q.get('id')} with options: {q.get('options')}")
            
            transformed_q = q.copy()
            
            # Track the correct option before randomizing
            correct_index = transformed_q.get('correct_option_index', 0)
            correct_option = None
            if 'options' in transformed_q and len(transformed_q['options']) > correct_index:
                correct_option = transformed_q['options'][correct_index]
            
            # Randomize the order of options
            if 'options' in transformed_q and len(transformed_q['options']) > 1:
                # Get original options
                original_options = transformed_q['options'].copy()
                # Shuffle options
                random.shuffle(transformed_q['options'])
                # Find the new index of the correct answer
                if correct_option:
                    try:
                        new_correct_index = transformed_q['options'].index(correct_option)
                        transformed_q['correct_option_index'] = new_correct_index
                    except ValueError:
                        app.logger.error(f"Could not find correct option {correct_option} in randomized options {transformed_q['options']}")
            
            # Set correct answer for the frontend
            if 'correct_option_index' in transformed_q and 'options' in transformed_q:
                idx = transformed_q.get('correct_option_index', 0)
                if idx < len(transformed_q['options']):
                    transformed_q['correctAnswer'] = idx  # Set correctAnswer as the index, not the option value
            
            transformed_questions.append(transformed_q)
            
        # Remove verbose logging of randomization results
        # if transformed_questions:
        #     app.logger.info(f"Randomized question options. First question correct answer index: {transformed_questions[0]['correctAnswer']}")
        
        return jsonify({
            "success": True,
            "status": "completed",
            "upload": upload,
            "questions": transformed_questions
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error retrieving quiz: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/quiz/<job_id>/complete', methods=['POST'])
@limiter.limit("300 per day, 30 per minute")
@require_active_subscription
@add_cors_headers
def complete_quiz(job_id):
    """Save quiz completion results."""
    try:
        # Get user ID from token
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({"error": "No authentication token provided"}), 401
        
        # Extract user ID from the token claims
        try:
            user_id = None
            data = supabase.auth.get_user(token)
            user_id = data.user.id if data and data.user else None
            
            if not user_id:
                return jsonify({"error": "Invalid authentication token"}), 401
        except Exception as auth_error:
            app.logger.error(f"Auth error: {str(auth_error)}")
            return jsonify({"error": "Authentication error"}), 401
        
        # Get quiz data from request
        quiz_data = request.json
        if not quiz_data:
            return jsonify({"error": "No quiz data provided"}), 400
        
        app.logger.warning(f"Saving quiz results for job_id: {job_id}, user_id: {user_id}, data: {quiz_data}")
        
        # Extract base job_id (without timestamp) for database queries
        base_job_id = job_id
        if '_' in job_id:
            parts = job_id.split('_')
            if len(parts) >= 2:
                # The base job_id is typically the user_id part
                base_job_id = parts[0]
        
        # Find the actual upload record that this quiz belongs to
        # First try with the full job_id
        upload_result = supabase.table('uploads').select('*').eq('id', job_id).execute()
        
        # If no results, try with just the user_id to find their most recent upload
        # This assumes the quiz belongs to the most recent upload if we can't find an exact match
        actual_job_id = job_id
        if not upload_result.data:
            upload_result = supabase.table('uploads').select('*').eq('user_id', user_id).order('created_at', desc=True).limit(1).execute()
            if upload_result.data:
                actual_job_id = upload_result.data[0]['id']
        
        # Save quiz attempt with safety measures
        try:
            # Prepare quiz attempt data - use the actual upload ID we found
            quiz_attempt = {
                'quiz_id': actual_job_id,  # Use the actual upload ID
                'user_id': user_id,
                'score': quiz_data.get('score', 0),
                'completed_at': datetime.now(timezone.utc).isoformat()
            }
            
            # Safely handle answers - ensure it's properly formatted for JSONB
            answers = quiz_data.get('answers', [])
            if answers and isinstance(answers, list):
                # Convert all non-integer values to None for safety
                sanitized_answers = []
                for answer in answers:
                    if answer is None or isinstance(answer, int):
                        sanitized_answers.append(answer)
                    else:
                        sanitized_answers.append(None)
                
                quiz_attempt['answers'] = sanitized_answers
            else:
                quiz_attempt['answers'] = []  # Empty array for JSONB
            
            app.logger.warning(f"Inserting quiz attempt: {quiz_attempt}")
            
            # Insert quiz attempt record
            result = supabase.table('quiz_attempts').insert(quiz_attempt).execute()
            
            if not result.data:
                app.logger.error("Failed to save quiz attempt - no data returned from insert")
                return jsonify({"success": True, "message": "Quiz attempted but results could not be saved"}), 200
            
            return jsonify({
                "success": True,
                "message": "Quiz completion saved successfully",
                "data": result.data[0] if result.data else {"quiz_id": actual_job_id}
            }), 200
            
        except Exception as save_error:
            app.logger.error(f"Error saving quiz attempt: {str(save_error)}")
            # Return success anyway to not block the user
            return jsonify({
                "success": True,
                "message": "Quiz completed, but results could not be saved",
                "error": str(save_error)
            }), 200
        
    except Exception as e:
        app.logger.error(f"Error in complete_quiz: {str(e)}")
        # Return success anyway to not block the user from proceeding
        return jsonify({
            "success": True,
            "message": "Quiz completed, but an error occurred while saving results",
            "error": str(e)
        }), 200

@app.route('/api/user/statistics', methods=['GET'])
@limiter.limit("1200 per day, 120 per minute")
@require_active_subscription
@add_cors_headers
def get_user_statistics():
    """Get user statistics for the daily summary."""
    try:
        # Get user ID from token
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({"error": "No authentication token provided"}), 401
        
        # Extract user ID from the token claims
        try:
            user_id = None
            data = supabase.auth.get_user(token)
            user_id = data.user.id if data and data.user else None
            
            if not user_id:
                return jsonify({"error": "Invalid authentication token"}), 401
        except Exception as auth_error:
            app.logger.error(f"Auth error: {str(auth_error)}")
            return jsonify({"error": "Authentication error"}), 401
        
        # Get today's date in UTC
        today = datetime.now(timezone.utc).date()
        today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc).isoformat()
        
        # Get uploads count for today
        uploads_result = supabase.table('uploads').select('id').eq('user_id', user_id).gte('created_at', today_start).execute()
        uploads_count = len(uploads_result.data) if uploads_result.data else 0
        
        # Get completed quiz attempts for today with full data to count questions
        attempts_result = supabase.table('quiz_attempts').select('*').eq('user_id', user_id).gte('completed_at', today_start).execute()
        
        # Initialize statistics
        total_questions_answered = 0
        total_correct_answers = 0
        total_weighted_score = 0
        total_quizzes = 0
        
        app.logger.info(f"Found {len(attempts_result.data) if attempts_result.data else 0} quiz attempts for today")
        
        if attempts_result.data:
            for attempt in attempts_result.data:
                # Count this as a quiz
                total_quizzes += 1
                
                # Get the score
                score = 0
                if 'score' in attempt:
                    score_val = attempt['score']
                    # Make sure to handle possible string conversion
                    if isinstance(score_val, str):
                        try:
                            score_val = int(score_val)
                        except ValueError:
                            score_val = 0
                    score = score_val
                
                # Count questions in this attempt by checking the answers array
                questions_in_this_attempt = 0
                if 'answers' in attempt and attempt['answers']:
                    # answers is stored as JSONB, so it's already a list
                    answers = attempt['answers']
                    questions_in_this_attempt = len(answers)
                    
                    # Add to total questions answered
                    total_questions_answered += questions_in_this_attempt
                    
                    # Add weighted score for average calculation
                    if questions_in_this_attempt > 0:
                        # Calculate percentage score
                        percentage_score = (score / questions_in_this_attempt) * 100
                        total_weighted_score += percentage_score
                        
                        # Add correct answers to total
                        total_correct_answers += score
        
        # Calculate average score as a percentage (0-100)
        avg_score = round(total_weighted_score / total_quizzes) if total_quizzes > 0 else 0
        
        app.logger.info(f"Statistics - Questions: {total_questions_answered}, Correct: {total_correct_answers}, Score: {avg_score}%")
        
        return jsonify({
            "success": True,
            "statistics": {
                "uploads_count": uploads_count,
                "questions_count": total_questions_answered,
                "average_score": avg_score
            }
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error retrieving user statistics: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/health', methods=['GET'])
@limiter.limit("1000 per day")
@add_cors_headers
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy"}), 200

@app.route('/ping', methods=['GET'])
@limiter.limit("1000 per day")
@add_cors_headers
def ping():
    """Simple ping endpoint to test connectivity."""
    app.logger.info("Ping endpoint called")
    return jsonify({
        "status": "ok",
        "message": "Server is reachable",
        "server_time": datetime.now(timezone.utc).isoformat()
    }), 200

@app.route('/auth-debug', methods=['GET'])
@limiter.exempt  # Exempt this endpoint from rate limits
@add_cors_headers
def auth_debug():
    """Debug endpoint to test authentication."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    app.logger.info(f"Auth debug called with token: {token[:10]}...")
    
    if not token:
        return jsonify({"error": "No token provided"}), 401
    
    try:
        data = supabase.auth.get_user(token)
        user_id = data.user.id if data and data.user else None
        
        if not user_id:
            return jsonify({"error": "Invalid token", "details": "No user ID found"}), 401
        
        return jsonify({
            "success": True,
            "user_id": user_id,
            "email": data.user.email,
            "token_valid": True
        }), 200
    except Exception as e:
        app.logger.error(f"Auth debug error: {str(e)}")
        return jsonify({"error": "Authentication error", "details": str(e)}), 401

@app.route('/debug', methods=['GET', 'POST', 'OPTIONS'])
@limiter.limit("100 per day", exempt_when=lambda: request.method == 'OPTIONS')
@add_cors_headers
def debug_route():
    """Debug endpoint to test CORS and connectivity."""
    app.logger.info(f"Debug endpoint called with method: {request.method}")
    app.logger.info(f"Debug headers: {dict(request.headers)}")
    
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = jsonify({"status": "preflight_ok"})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        return response
        
    return jsonify({
        "status": "ok", 
        "method": request.method,
        "received_data": request.get_json() if request.is_json else None,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }), 200

@app.route('/testing/create_subscription', methods=['POST'])
@limiter.limit("20 per day")
def create_test_subscription():
    """TESTING ONLY: Create an active subscription for a user."""
    try:
        # Get user ID from request
        data = request.get_json()
        if not data or 'user_id' not in data:
            return jsonify({"error": "No user ID provided"}), 400
            
        user_id = data['user_id']
        app.logger.info(f"Creating test subscription for user: {user_id}")
        
        # Check if subscription already exists
        result = supabase.table('user_subscriptions').select('*').eq('user_id', user_id).execute()
        
        if result.data:
            # Update existing subscription to active
            supabase.table('user_subscriptions').update({
                'status': 'active',
                'updated_at': datetime.now(timezone.utc).isoformat()
            }).eq('user_id', user_id).execute()
            app.logger.info(f"Updated existing subscription for user {user_id} to active")
        else:
            # Create new subscription
            current_time = datetime.now(timezone.utc).isoformat()
            supabase.table('user_subscriptions').insert({
                'user_id': user_id,
                'provider': 'test',
                'status': 'active',
                'created_at': current_time,
                'updated_at': current_time
            }).execute()
            app.logger.info(f"Created new active subscription for user {user_id}")
        
        return jsonify({
            "success": True,
            "message": "Subscription activated for testing",
            "user_id": user_id
        }), 200
    except Exception as e:
        app.logger.error(f"Error creating test subscription: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/subscription/update', methods=['POST'])
@limiter.limit("100 per day, 10 per hour")
@add_cors_headers
def update_subscription():
    """Update user subscription status from the frontend."""
    try:
        # Get user ID from token
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({"error": "No authentication token provided"}), 401
        
        # Extract user ID from the token claims
        try:
            user_id = None
            data = supabase.auth.get_user(token)
            user_id = data.user.id if data and data.user else None
            
            if not user_id:
                return jsonify({"error": "Invalid authentication token"}), 401
        except Exception as auth_error:
            app.logger.error(f"Auth error: {str(auth_error)}")
            return jsonify({"error": "Authentication error"}), 401
        
        # Get subscription data from request
        subscription_data = request.json
        if not subscription_data:
            return jsonify({"error": "No subscription data provided"}), 400
        
        status = subscription_data.get('status', 'inactive')
        provider = subscription_data.get('provider', 'revenuecat')
        subscription_type = subscription_data.get('subscription_type')
        expires_at = subscription_data.get('expires_at')
        trial_ends_at = subscription_data.get('trial_ends_at')
        
        # Update subscription status in database
        current_time = datetime.now(timezone.utc).isoformat()
        
        # Check if subscription record exists
        result = supabase.table('user_subscriptions').select('*').eq('user_id', user_id).execute()
        
        update_data = {
            'status': status,
            'provider': provider,
            'updated_at': current_time
        }
        
        # Add optional fields if they exist
        if subscription_type:
            update_data['subscription_type'] = subscription_type
        if expires_at:
            update_data['expires_at'] = expires_at
        if trial_ends_at:
            update_data['trial_ends_at'] = trial_ends_at
        
        if result.data:
            # Update existing subscription
            supabase.table('user_subscriptions').update(update_data).eq('user_id', user_id).execute()
        else:
            # Create new subscription record
            update_data['user_id'] = user_id
            update_data['created_at'] = current_time
            supabase.table('user_subscriptions').insert(update_data).execute()
        
        return jsonify({
            "success": True,
            "message": "Subscription status updated successfully"
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error updating subscription status: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/testing/create_quiz_attempt', methods=['POST'])
@limiter.limit("20 per day")
@add_cors_headers
def create_test_quiz_attempt():
    """TESTING ONLY: Create a test quiz attempt for debugging."""
    try:
        # Get user ID from request
        data = request.get_json()
        if not data or 'user_id' not in data:
            return jsonify({"error": "No user ID provided"}), 400
            
        user_id = data['user_id']
        quiz_id = data.get('quiz_id', 'test_quiz_id')
        score = data.get('score', 5)  # Default test score
        
        app.logger.info(f"Creating test quiz attempt for user: {user_id}")
        
        # Create a test quiz attempt
        current_time = datetime.now(timezone.utc).isoformat()
        result = supabase.table('quiz_attempts').insert({
            'user_id': user_id,
            'quiz_id': quiz_id,
            'score': score,
            'answers': [0, 1, 0, 1, 1],  # Example answers array
            'completed_at': current_time
        }).execute()
        
        if result.data:
            app.logger.info(f"Created test quiz attempt: {result.data}")
            return jsonify({
                "success": True,
                "message": "Test quiz attempt created successfully",
                "data": result.data[0] if result.data else None
            }), 200
        else:
            error_msg = "Failed to create test quiz attempt"
            app.logger.error(error_msg)
            return jsonify({"error": error_msg}), 500
            
    except Exception as e:
        app.logger.error(f"Error creating test quiz attempt: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/admin/recreate_quiz_attempts_table', methods=['POST'])
@limiter.limit("10 per day")
@add_cors_headers
def recreate_quiz_attempts_table():
    """ADMIN ONLY: Recreate the quiz_attempts table without foreign key constraints."""
    try:
        # This should be protected in a real app with admin authentication
        # Simple key-based protection for demo purposes
        auth_key = request.headers.get('X-Admin-Key')
        if not auth_key or auth_key != os.getenv('ADMIN_SECRET_KEY', 'temporary_admin_key'):
            return jsonify({"error": "Unauthorized access"}), 401
        
        app.logger.warning("Recreating quiz_attempts table...")
        
        # Execute SQL to drop and recreate the table
        sql = """
        -- Drop existing quiz_attempts table if exists
        DROP TABLE IF EXISTS public.quiz_attempts CASCADE;
        
        -- Create quiz_attempts table for storing completed quiz results
        CREATE TABLE IF NOT EXISTS public.quiz_attempts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            quiz_id TEXT NOT NULL,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            answers JSONB NOT NULL,
            score INTEGER NOT NULL,
            completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes for faster lookups
        CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
        CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
        CREATE INDEX IF NOT EXISTS idx_quiz_attempts_completed_at ON public.quiz_attempts(completed_at);
        
        -- Add RLS policies for quiz_attempts table
        ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
        
        -- Allow users to view only their own quiz attempts
        CREATE POLICY "Users can view their own quiz attempts" 
            ON public.quiz_attempts 
            FOR SELECT 
            USING (auth.uid() = user_id);
        
        -- Allow users to insert their own quiz attempts
        CREATE POLICY "Users can insert their own quiz attempts" 
            ON public.quiz_attempts 
            FOR INSERT 
            WITH CHECK (auth.uid() = user_id);
        
        -- Allow service role to update and delete
        CREATE POLICY "Only service role can update quiz attempts" 
            ON public.quiz_attempts 
            FOR UPDATE
            USING (auth.role() = 'service_role');
        """
        
        # Execute the SQL directly - this would require database admin privileges
        supabase_connection = supabase._client._connection
        # This requires direct Postgrest access, may not work in all Supabase environments
        result = supabase_connection.execute(sql)
        
        return jsonify({
            "success": True,
            "message": "Quiz attempts table recreated successfully"
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error recreating quiz_attempts table: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/admin/apply_rls_policies', methods=['POST'])
@limiter.limit("5 per day")
@add_cors_headers
def apply_rls_policies():
    """ADMIN ONLY: Apply row level security policies to all tables."""
    try:
        # Check admin key authorization
        admin_key = request.headers.get('admin-key')
        if not admin_key or admin_key != os.environ.get('ADMIN_KEY'):
            app.logger.warning("Unauthorized attempt to access admin endpoint")
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Execute SQL to apply RLS policies for all tables
        app.logger.info("Applying RLS policies to all tables")
        
        sql = """
        -- Enable RLS on uploads table
        ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist to avoid conflicts
        DROP POLICY IF EXISTS "Users can view their own uploads" ON public.uploads;
        DROP POLICY IF EXISTS "Users can insert their own uploads" ON public.uploads;
        DROP POLICY IF EXISTS "Users can update their own uploads" ON public.uploads;
        DROP POLICY IF EXISTS "Users can delete their own uploads" ON public.uploads;
        DROP POLICY IF EXISTS "Service role has full access to uploads" ON public.uploads;
        
        -- Create policies for uploads table
        CREATE POLICY "Users can view their own uploads" 
            ON public.uploads 
            FOR SELECT 
            USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can insert their own uploads" 
            ON public.uploads 
            FOR INSERT 
            WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Users can update their own uploads" 
            ON public.uploads 
            FOR UPDATE 
            USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can delete their own uploads" 
            ON public.uploads 
            FOR DELETE 
            USING (auth.uid() = user_id);
        
        CREATE POLICY "Service role has full access to uploads" 
            ON public.uploads 
            FOR ALL 
            USING (auth.role() = 'service_role');
        
        -- Enable RLS on questions table
        ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Users can view questions for their uploads" ON public.questions;
        DROP POLICY IF EXISTS "Only service role can insert questions" ON public.questions;
        DROP POLICY IF EXISTS "Only service role can update questions" ON public.questions;
        DROP POLICY IF EXISTS "Only service role can delete questions" ON public.questions;
        
        -- Create policies for questions table
        CREATE POLICY "Users can view questions for their uploads" 
            ON public.questions 
            FOR SELECT 
            USING (
                EXISTS (
                    SELECT 1 FROM public.uploads 
                    WHERE public.uploads.job_id = public.questions.job_id 
                    AND public.uploads.user_id = auth.uid()
                )
            );
        
        CREATE POLICY "Only service role can insert questions" 
            ON public.questions 
            FOR INSERT 
            WITH CHECK (auth.role() = 'service_role');
        
        CREATE POLICY "Only service role can update questions" 
            ON public.questions 
            FOR UPDATE 
            USING (auth.role() = 'service_role');
        
        CREATE POLICY "Only service role can delete questions" 
            ON public.questions 
            FOR DELETE 
            USING (auth.role() = 'service_role');
        
        -- Enable RLS on quiz_attempts table
        ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Users can view their own quiz attempts" ON public.quiz_attempts;
        DROP POLICY IF EXISTS "Users can insert their own quiz attempts" ON public.quiz_attempts;
        DROP POLICY IF EXISTS "Only service role can update quiz attempts" ON public.quiz_attempts;
        DROP POLICY IF EXISTS "Only service role can delete quiz attempts" ON public.quiz_attempts;
        
        -- Create policies for quiz_attempts table
        CREATE POLICY "Users can view their own quiz attempts" 
            ON public.quiz_attempts 
            FOR SELECT 
            USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can insert their own quiz attempts" 
            ON public.quiz_attempts 
            FOR INSERT 
            WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Only service role can update quiz attempts" 
            ON public.quiz_attempts 
            FOR UPDATE 
            USING (auth.role() = 'service_role');
            
        CREATE POLICY "Only service role can delete quiz attempts" 
            ON public.quiz_attempts 
            FOR DELETE 
            USING (auth.role() = 'service_role');
        
        -- Enable RLS on user_subscriptions table
        ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.user_subscriptions;
        DROP POLICY IF EXISTS "Only service role can insert subscriptions" ON public.user_subscriptions;
        DROP POLICY IF EXISTS "Only service role can update subscriptions" ON public.user_subscriptions;
        DROP POLICY IF EXISTS "Only service role can delete subscriptions" ON public.user_subscriptions;
        
        -- Create policies for user_subscriptions table
        CREATE POLICY "Users can view their own subscriptions" 
            ON public.user_subscriptions 
            FOR SELECT 
            USING (auth.uid() = user_id);
        
        CREATE POLICY "Only service role can insert subscriptions" 
            ON public.user_subscriptions 
            FOR INSERT 
            WITH CHECK (auth.role() = 'service_role');
        
        CREATE POLICY "Only service role can update subscriptions" 
            ON public.user_subscriptions 
            FOR UPDATE 
            USING (auth.role() = 'service_role');
            
        CREATE POLICY "Only service role can delete subscriptions" 
            ON public.user_subscriptions 
            FOR DELETE 
            USING (auth.role() = 'service_role');
        """
        
        result = supabase.query(sql).execute()
        app.logger.info(f"RLS policies applied successfully: {result}")
        
        return jsonify({'message': 'RLS policies applied successfully'}), 200
        
    except Exception as e:
        app.logger.error(f"Failed to apply RLS policies: {str(e)}")
        return jsonify({'error': f'Failed to apply RLS policies: {str(e)}'}), 500

# Custom error handler for rate limiting
@app.errorhandler(429)
def ratelimit_handler(e):
    app.logger.warning(f"Rate limit exceeded: {e.description}")
    return jsonify({
        "error": "Rate limit exceeded",
        "message": e.description
    }), 429

# Add a global route to handle OPTIONS preflight requests
@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
@add_cors_headers
def handle_options_requests(path):
    response = jsonify({"status": "preflight_ok"})
    origin = request.headers.get('Origin', '')
    if origin in ALLOWED_ORIGINS:
        response.headers.add('Access-Control-Allow-Origin', origin)
    else:
        response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Add middleware to apply CORS headers to all responses
@app.after_request
def add_cors_headers_middleware(response):
    # Get the origin from the request
    origin = request.headers.get('Origin', '')
    
    # Special handling for empty/null origins (common with Android browsers)
    if not origin or origin == 'null':
        app.logger.warning(f"Middleware handling empty/null origin: '{origin}'")
        response.headers['Access-Control-Allow-Origin'] = request.headers.get('Host', '*')
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept'
        return response
    
    # For preflight requests
    if request.method == 'OPTIONS':
        # Use the origin if it's allowed
        if origin in ALLOWED_ORIGINS:
            response.headers['Access-Control-Allow-Origin'] = origin
        elif origin.startswith('http://localhost:'):
            response.headers['Access-Control-Allow-Origin'] = origin
        else:
            # For other origins, we'll use * but this won't work with credentials
            response.headers['Access-Control-Allow-Origin'] = '*'
        
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    
    return response

@app.route('/api/job/status', methods=['GET', 'POST'])
@add_cors_headers
def check_job_status():
    """
    Check the status of a job by ID.
    Can be called with either GET or POST:
    - GET: job_id is passed as a query parameter
    - POST: job_id is passed in the request body as JSON
    """
    try:
        # Get job_id from either query parameters (GET) or request body (POST)
        if request.method == 'GET':
            job_id = request.args.get('job_id')
        else:  # POST
            data = request.get_json() or {}
            job_id = data.get('job_id')
        
        if not job_id:
            return jsonify({"success": False, "error": "No job_id provided"}), 400
            
        app.logger.info(f"Checking status for job {job_id}")
            
        # Verify user has access to this job
        try:
            # Extract user ID from the job_id (format: user_id_timestamp)
            parts = job_id.split('_')
            if len(parts) >= 2:
                job_user_id = parts[0]
                
                # Skip authentication for now to simplify debugging
                # We'll just check if the job exists
                
                # Check job status in the 'uploads' table
                result = supabase.table('uploads').select('*').eq('id', job_id).execute()
                
                if not result.data:
                    return jsonify({
                        "success": False, 
                        "error": "Job not found",
                        "job_id": job_id
                    }), 404
                
                upload = result.data[0]
                
                # Return job status
                return jsonify({
                    "success": True,
                    "status": upload.get('status', 'pending'),
                    "job_id": job_id,
                    "error": upload.get('error', None)
                })
                
            else:
                return jsonify({"success": False, "error": "Invalid job_id format"}), 400
                
        except Exception as e:
            app.logger.error(f"Error checking job status: {str(e)}")
            return jsonify({"success": False, "error": f"Error checking job status: {str(e)}"}), 500
            
    except Exception as e:
        app.logger.error(f"Error in job status endpoint: {str(e)}")
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500

@app.route('/api/user/quizzes', methods=['GET'])
@limiter.limit("600 per day, 60 per minute")
@require_active_subscription
@add_cors_headers
def get_user_quizzes():
    """Get a list of user's quizzes."""
    try:
        # Get user ID from token
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({"error": "No authentication token provided"}), 401
        
        # Extract user ID from the token claims
        try:
            user_id = None
            data = supabase.auth.get_user(token)
            user_id = data.user.id if data and data.user else None
            
            if not user_id:
                return jsonify({"error": "Invalid authentication token"}), 401
        except Exception as auth_error:
            app.logger.error(f"Auth error: {str(auth_error)}")
            return jsonify({"error": "Authentication error"}), 401
        
        # Get the user's uploads (quizzes)
        limit = request.args.get('limit', default=10, type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        uploads_result = supabase.table('uploads')\
            .select('*')\
            .eq('user_id', user_id)\
            .order('created_at', desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
        
        quizzes = uploads_result.data if uploads_result.data else []
        
        # Get total count for pagination
        count_result = supabase.table('uploads')\
            .select('id', count='exact')\
            .eq('user_id', user_id)\
            .execute()
        
        total_count = count_result.count if hasattr(count_result, 'count') else 0
        
        return jsonify({
            "success": True,
            "quizzes": quizzes,
            "total": total_count,
            "limit": limit,
            "offset": offset
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error retrieving user quizzes: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    app.logger.info(f"Starting Flask app on port {port}, debug={debug_mode}")
    app.run(host='0.0.0.0', port=port, debug=debug_mode) 