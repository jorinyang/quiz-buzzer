// =====================================================
// Supabase 客户端工厂
// =====================================================
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mqsqcpkcmcgwbzcsmrlm.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let _client: ReturnType<typeof createClient> | null = null

export function getSupabase(): ReturnType<typeof createClient> {
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey)
  }
  return _client
}

export function getSupabaseAdmin(): ReturnType<typeof createClient> {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || '')
}

export const supabase = getSupabase()
