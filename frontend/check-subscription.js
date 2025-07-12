// Simple script to check subscription status in Supabase
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Log available env variables (without sensitive values)
console.log('Environment variables:', {
  'SUPABASE_URL exists': !!process.env.SUPABASE_URL,
  'NEXT_PUBLIC_SUPABASE_URL exists': !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  'SUPABASE_ANON_KEY exists': !!process.env.SUPABASE_ANON_KEY,
  'NEXT_PUBLIC_SUPABASE_ANON_KEY exists': !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  'SUPABASE_SERVICE_KEY exists': !!process.env.SUPABASE_SERVICE_KEY
});

// Get Supabase configuration from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Check for missing environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERROR: Missing Supabase configuration!");
  console.error("Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file");
  process.exit(1);
}

console.log('Using Supabase configuration from environment variables');

// Create a supabase client for interacting with your database
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSubscription() {
  try {
    // Get user email from arguments or use a default
    const userEmail = process.argv[2] || null;
    
    console.log('Checking subscriptions...');
    
    // If email provided, try to get the user ID first
    let userId = null;
    
    if (userEmail) {
      console.log(`Looking up user with email: ${userEmail}`);
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
      
      if (userError) {
        console.error('Error fetching users (might need service role key):', userError);
        console.log('Trying direct subscription query...');
      } else if (userData) {
        const user = userData.users.find(u => u.email === userEmail);
        if (user) {
          userId = user.id;
          console.log(`Found user with ID: ${userId}`);
        } else {
          console.log(`No user found with email: ${userEmail}`);
        }
      }
    }
    
    // Query for subscriptions
    const query = supabase.from('user_subscriptions').select('*');
    
    // If user ID is provided, filter by it
    if (userId) {
      query.eq('user_id', userId);
    }
    
    const { data: subscriptions, error } = await query;
    
    if (error) {
      console.error('Error fetching subscriptions:', error);
      return;
    }
    
    console.log('=== Subscription Status ===');
    if (!subscriptions || subscriptions.length === 0) {
      console.log('No subscriptions found');
    } else {
      subscriptions.forEach(sub => {
        console.log(`User: ${sub.user_id}`);
        console.log(`Status: ${sub.status}`);
        console.log(`Provider: ${sub.provider}`);
        console.log(`Created: ${sub.created_at}`);
        console.log(`Updated: ${sub.updated_at}`);
        console.log('------------------------');
      });
    }
    
    // Check if getting all profiles works
    console.log('\nChecking profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, created_at')
      .limit(5);
      
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    } else {
      console.log(`Found ${profiles?.length || 0} profiles`);
      if (profiles && profiles.length > 0) {
        profiles.forEach(profile => {
          console.log(`Profile ID: ${profile.id}`);
          console.log(`Name: ${profile.full_name}`);
          console.log(`Created: ${profile.created_at}`);
          console.log('------------------------');
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSubscription(); 