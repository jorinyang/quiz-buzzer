// =====================================================
// Admin Supabase Client — used in API routes with service_role
// =====================================================
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mqsqcpkcmcgwbzcsmrlm.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

let _adminClient: ReturnType<typeof createClient> | null = null

export function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(supabaseUrl, serviceRoleKey)
  }
  return _adminClient
}
