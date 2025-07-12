// Debug script for testing statistics and quiz attempts
const fetch = require('node-fetch');

// Configuration
const BASE_URL = process.env.API_URL || 'YOUR_BACKEND_API_URL';
const USER_ID = process.argv[2]; // Pass user ID as the first CLI argument

if (!USER_ID) {
  console.error('Please provide a user ID as the first argument');
  console.log('Usage: node debug-stats.js USER_ID [AUTH_TOKEN]');
  process.exit(1);
}

// Optional auth token
const AUTH_TOKEN = process.argv[3] || null;

async function main() {
  console.log('SikumAI Statistics Debug Tool');
  console.log('----------------------------');
  console.log(`Using API URL: ${BASE_URL}`);
  console.log(`Testing for user ID: ${USER_ID}`);
  
  try {
    // 1. Create a test quiz attempt
    console.log('\n🔍 Creating a test quiz attempt...');
    const quizResponse = await fetch(`${BASE_URL}/testing/create_quiz_attempt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_TOKEN && { 'Authorization': `Bearer ${AUTH_TOKEN}` })
      },
      body: JSON.stringify({
        user_id: USER_ID,
        quiz_id: 'test_quiz_id',
        score: 85
      })
    });
    
    const quizData = await quizResponse.json();
    console.log('Response:', JSON.stringify(quizData, null, 2));
    
    if (quizData.success) {
      console.log('✅ Test quiz attempt created successfully');
    } else {
      console.log('❌ Failed to create test quiz attempt');
    }
    
    // 2. Wait a moment for the database to update
    console.log('\nWaiting for 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Query the statistics
    console.log('\n🔍 Querying user statistics...');
    if (!AUTH_TOKEN) {
      console.log('❌ Cannot query statistics without an auth token');
      return;
    }
    
    const statsResponse = await fetch(`${BASE_URL}/api/user/statistics`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    
    const statsData = await statsResponse.json();
    console.log('Statistics Response:', JSON.stringify(statsData, null, 2));
    
    if (statsData.success) {
      console.log('✅ Statistics retrieved successfully');
      console.log(`📊 Questions completed: ${statsData.statistics.questions_count}`);
      console.log(`📊 Average score: ${statsData.statistics.average_score}`);
      console.log(`📊 Uploads count: ${statsData.statistics.uploads_count}`);
    } else {
      console.log('❌ Failed to retrieve statistics');
    }
    
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

main().catch(console.error); 