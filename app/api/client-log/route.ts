import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { message, data } = await req.json();
    await supabaseAdmin.from('client_logs').insert({ message, data });
  } catch {}
  return new Response(null, { status: 204 });
}
