import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get the Supabase URL and key from environment variables
// IMPORTANT: You must set these in your .env file and app.config.js
const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || 
                   process.env.EXPO_PUBLIC_SUPABASE_URL;
                   
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Check for missing environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("CRITICAL ERROR: Missing Supabase configuration!");
  console.error("Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file");
}

// Log the values to help debug (will show in build logs)
console.log("Using Supabase client with URL and key available:", !!supabaseUrl && !!supabaseAnonKey);

// Determine if we're in development mode
const isDevelopment = __DEV__;

// In development mode, clear any existing session on app start
if (isDevelopment) {
  AsyncStorage.removeItem('supabase-auth-token')
    .then(() => console.log('Cleared existing auth session for development'))
    .catch(error => console.error('Error clearing auth session:', error));
}

// Determine the site URL for auth redirects
const getSiteUrl = () => {
  if (Platform.OS !== 'web') return 'sikumai://auth/callback';
  
  if (process.env.NODE_ENV === 'production') {
    return process.env.EXPO_PUBLIC_SITE_URL || 'YOUR_SITE_URL';
  }
  
  return 'http://localhost:5000';
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: !isDevelopment, // Don't persist session in development
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
}); 