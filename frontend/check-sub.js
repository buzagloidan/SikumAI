// Simple script to check subscription status in Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get values from environment variables - MUST be set in .env file
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Check for missing environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERROR: Missing Supabase configuration!");
  console.error("Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file");
  process.exit(1);
}

console.log("Using Supabase configuration from environment variables");

// Create a supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSubscriptions() {
  try {
    console.log('Checking all subscriptions in the database...');
    
    // Query for all subscriptions
    const { data: subscriptions, error } = await supabase
      .from('user_subscriptions')
      .select('*');
    
    if (error) {
      console.error('Error fetching subscriptions:', error);
      return;
    }
    
    console.log(`\n=== Found ${subscriptions?.length || 0} Subscriptions ===`);
    if (!subscriptions || subscriptions.length === 0) {
      console.log('No subscriptions found in the database');
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
    
    // Check if profiles table is accessible
    console.log('\nChecking if your user profile exists...');
    
    // Get current user (this will fail with anon key)
    console.log('\nTrying to get current user (will likely fail with anon key)...');
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.log('Could not get current user:', userError.message);
    } else if (userData && userData.user) {
      console.log('Current user:', userData.user.email);
      
      // Check if user has a subscription
      const { data: userSub, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userData.user.id)
        .limit(1);
        
      if (subError) {
        console.error('Error checking user subscription:', subError);
      } else {
        console.log('\n=== Your Subscription Status ===');
        if (!userSub || userSub.length === 0) {
          console.log('No active subscription found for your account');
        } else {
          console.log(`Status: ${userSub[0].status}`);
          console.log(`Provider: ${userSub[0].provider}`);
          console.log(`Created: ${userSub[0].created_at}`);
          console.log(`Updated: ${userSub[0].updated_at}`);
        }
      }
    }
    
    // Try to list some profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, created_at')
      .limit(5);
      
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    } else {
      console.log(`\nFound ${profiles?.length || 0} profiles`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSubscriptions(); 