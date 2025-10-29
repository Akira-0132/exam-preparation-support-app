import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerComponentClient<Database>({ 
    cookies: () => cookieStore 
  });
}
