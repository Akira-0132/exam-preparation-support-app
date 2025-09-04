// Supabase直接テストスクリプト
// このスクリプトをブラウザのコンソールで実行してテスト

const testSignup = async () => {
  const SUPABASE_URL = 'https://gsdtjllpjkewqmlyxwtu.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzZHRqbGxwamtld3FtbHl4d3R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNTA0OTQsImV4cCI6MjA3MTgyNjQ5NH0.Q_KtjhZ2prcMPfxejsFBs2pwDDB8QM1W9y0Rv-QZ4_w';

  // テスト用のランダムメール生成
  const randomEmail = `test${Date.now()}@example.com`;
  
  console.log('Testing with email:', randomEmail);

  // 1. まず認証ユーザーを作成
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      email: randomEmail,
      password: 'Test1234!'
    })
  });

  const authData = await authResponse.json();
  console.log('Auth response:', authData);

  if (authData.id) {
    // 2. プロファイルを作成
    const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authData.access_token || SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: authData.id,
        email: randomEmail,
        display_name: 'Test User',
        role: 'student'
      })
    });

    const profileData = await profileResponse.json();
    console.log('Profile response:', profileData);
    
    if (!profileResponse.ok) {
      console.error('Profile creation failed:', profileResponse.status, profileData);
    }
  }
};

// 実行
testSignup();