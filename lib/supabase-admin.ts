import { createClient } from '@supabase/supabase-js'

// サーバーサイド専用のSupabaseクライアント (Service Role Key使用)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// 管理者用クライアント（RLSをバイパス可能）
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// 管理者権限でのユーザー操作用
export const adminAuth = supabaseAdmin.auth.admin