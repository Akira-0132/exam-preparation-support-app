import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

export function createServerSupabase() {
  return createServerComponentClient<Database>({ cookies });
}
