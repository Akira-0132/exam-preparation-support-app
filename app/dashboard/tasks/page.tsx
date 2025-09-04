'use client';

import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function TasksPage() {
  const router = useRouter();

  return (
    <div className="max-w-3xl mx-auto">
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>タスク（準備中）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-700">
            このページは現在準備中です。近日中に、全タスクの一覧やフィルタ機能を提供予定です。
          </p>
          <Button onClick={() => router.push('/dashboard')}>ダッシュボードに戻る</Button>
        </CardContent>
      </Card>
    </div>
  );
}


