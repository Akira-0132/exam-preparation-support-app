'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('サインイン処理中です...');

  useEffect(() => {
    let active = true;

    const handle = async () => {
      try {
        // Supabase SDKがURLのクエリを処理してセッションを確立するまで少し待機
        await new Promise(resolve => setTimeout(resolve, 400));
        const { data: { session } } = await supabase!.auth.getSession();
        if (!active) return;
        if (session?.user) {
          setMessage('サインインに成功しました。ダッシュボードへ移動します。');
          router.replace('/dashboard');
        } else {
          setMessage('サインイン状態を確認できませんでした。ログイン画面に戻ります。');
          setTimeout(() => router.replace('/login'), 600);
        }
      } catch (e) {
        setMessage('エラーが発生しました。ログイン画面に戻ります。');
        setTimeout(() => router.replace('/login'), 600);
      }
    };

    handle();
    return () => { active = false; };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 bg-white rounded-lg shadow-sm">
        <div className="text-lg text-gray-800 font-medium">{message}</div>
        <div className="mt-2 text-sm text-gray-500">このままお待ちください。</div>
      </div>
    </div>
  );
}
