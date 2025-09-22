"use client";

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { type ClassItem } from '@/lib/supabase/classes';

export default function ClassesAdminPage() {
  const { currentUser, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState<string>('');

  const isTeacher = userProfile?.role === 'teacher';

  useEffect(() => {
    const run = async () => {
      if (!currentUser || !isTeacher) return;
      setLoading(true);
      setError('');
      try {
        // クラスシステムは使用しないため、空配列を設定
        console.log('[ClassesAdminPage] Class system is deprecated, using school-grade system instead');
        setClasses([]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [currentUser, isTeacher]);

  const filtered = useMemo(() => {
    if (!q.trim()) return classes;
    const s = q.trim().toLowerCase();
    return classes.filter((c) => `${c.name}`.toLowerCase().includes(s));
  }, [classes, q]);

  const handleSetHomeroom = async (classId: string) => {
    setError('クラスシステムは廃止されました。学校・学年システムを使用してください。');
  };

  const handleUnsetHomeroom = async (classId: string) => {
    setError('クラスシステムは廃止されました。学校・学年システムを使用してください。');
  };

  const handleAddManaged = async (classId: string) => {
    setError('クラスシステムは廃止されました。学校・学年システムを使用してください。');
  };

  const handleRemoveManaged = async (classId: string) => {
    setError('クラスシステムは廃止されました。学校・学年システムを使用してください。');
  };

  if (!isTeacher) {
    return <div className="p-6">権限がありません。</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">先生用: クラス管理</h1>
        <Button onClick={() => location.assign('/dashboard')}>ダッシュボードへ</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>クラス検索 / 新規作成</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="クラス名で検索" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="新規クラス名" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="学年(数値) 例: 1" value={newGrade} onChange={(e) => setNewGrade(e.target.value.replace(/[^0-9]/g, ''))} />
            <Button
              disabled={true}
              onClick={() => {
                setError('クラスシステムは廃止されました。学校・学年システムを使用してください。');
              }}
            >
              クラスシステムは廃止されました
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>クラス一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>読み込み中...</p>
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">クラスシステムは廃止されました。</p>
              <p className="text-sm text-gray-500">学校・学年システムを使用してください。</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


