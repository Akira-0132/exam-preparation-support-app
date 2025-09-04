'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestPage() {
  const [status, setStatus] = useState<any>({
    supabaseClient: false,
    session: null,
    error: null,
    loading: true
  });

  useEffect(() => {
    const checkSupabase = async () => {
      console.log('[TestPage] Checking Supabase...');
      
      // Supabaseクライアントの確認
      const clientExists = !!supabase;
      console.log('[TestPage] Supabase client exists:', clientExists);
      
      if (!clientExists) {
        setStatus({
          supabaseClient: false,
          session: null,
          error: 'Supabase client not initialized',
          loading: false
        });
        return;
      }

      try {
        // セッション取得を試行
        if (!supabase) {
          throw new Error('Supabase client not initialized');
        }
        const { data, error } = await supabase.auth.getSession();
        console.log('[TestPage] Session check result:', { data, error });
        
        setStatus({
          supabaseClient: true,
          session: data?.session,
          error: error?.message || null,
          loading: false
        });
      } catch (err) {
        console.error('[TestPage] Error:', err);
        setStatus({
          supabaseClient: true,
          session: null,
          error: String(err),
          loading: false
        });
      }
    };

    checkSupabase();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Supabase Connection Test</h1>
      
      <div className="space-y-2">
        <div>
          <strong>Status:</strong> {status.loading ? 'Loading...' : 'Ready'}
        </div>
        <div>
          <strong>Supabase Client:</strong> {status.supabaseClient ? '✅ Initialized' : '❌ Not initialized'}
        </div>
        <div>
          <strong>Session:</strong> {status.session ? '✅ Active' : '❌ No session'}
        </div>
        {status.error && (
          <div className="text-red-600">
            <strong>Error:</strong> {status.error}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-2">Environment Variables</h2>
        <div className="text-sm font-mono">
          <div>NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set'}</div>
          <div>NEXT_PUBLIC_SUPABASE_ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '***' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(-10) : 'Not set'}</div>
        </div>
      </div>
    </div>
  );
}