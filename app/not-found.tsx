'use client';

import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

export default function NotFound() {
  const router = useRouter();
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">ページが見つかりません</h1>
        <p className="text-gray-600">URLが正しいかご確認ください。</p>
        <div className="space-x-3">
          <Button onClick={() => router.back()}>前のページに戻る</Button>
          <Button variant="secondary" onClick={() => router.push('/dashboard')}>ダッシュボードへ</Button>
        </div>
      </div>
    </main>
  );
}


