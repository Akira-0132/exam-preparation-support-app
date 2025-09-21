import { createClient } from '@supabase/supabase-js'

// Supabase設定の値が全て揃っているかチェック
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Supabase client initialization

// Supabaseクライアントを作成（シンプルに）
const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

if (!supabase) {
  console.error('[Supabase] Failed to initialize - missing environment variables');
}

export { supabase }
export default supabase