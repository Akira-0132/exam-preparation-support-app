"use client";

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { fetchClassesForTeacher, setHomeroomTeacher, addManagedClass, removeManagedClass, createClass, type ClassItem } from '@/lib/supabase/classes';

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
        const up: any = userProfile as any;
        const managed: string[] = Array.isArray(up?.managedClassIds) ? up.managedClassIds : [];
        const data = await fetchClassesForTeacher(currentUser.id, managed);
        setClasses(data);
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
    if (!currentUser) return;
    setLoading(true);
    try {
      await setHomeroomTeacher(classId, currentUser.id);
      const up: any = userProfile as any;
      const managed: string[] = Array.isArray(up?.managedClassIds) ? up.managedClassIds : [];
      const data = await fetchClassesForTeacher(currentUser.id, managed);
      setClasses(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleUnsetHomeroom = async (classId: string) => {
    setLoading(true);
    try {
      await setHomeroomTeacher(classId, null);
      if (currentUser) {
        const up: any = userProfile as any;
        const managed: string[] = Array.isArray(up?.managedClassIds) ? up.managedClassIds : [];
        const data = await fetchClassesForTeacher(currentUser.id, managed);
        setClasses(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleAddManaged = async (classId: string) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      await addManagedClass(currentUser.id, classId);
      const up: any = userProfile as any;
      const managed: string[] = Array.isArray(up?.managedClassIds) ? up.managedClassIds : [];
      const data = await fetchClassesForTeacher(currentUser.id, managed);
      setClasses(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveManaged = async (classId: string) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      await removeManagedClass(currentUser.id, classId);
      const up: any = userProfile as any;
      const managed: string[] = Array.isArray(up?.managedClassIds) ? up.managedClassIds : [];
      const data = await fetchClassesForTeacher(currentUser.id, managed);
      setClasses(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
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
              disabled={!newName.trim()}
              onClick={async () => {
                try {
                  setLoading(true);
                  setError('');
                  if (!currentUser) throw new Error('Not authenticated');
                  if (newGrade.trim() === '') throw new Error('学年は必須です');
                  const id = await createClass(newName.trim(), Number(newGrade), currentUser.id);
                  // 作成直後に自分を担任に設定
                  if (id && currentUser) {
                    await setHomeroomTeacher(id, currentUser.id);
                  }
                  if (currentUser) {
                    const up: any = userProfile as any;
                    const managed: string[] = Array.isArray(up?.managedClassIds) ? up.managedClassIds : [];
                    const data = await fetchClassesForTeacher(currentUser.id, managed);
                    setClasses(data);
                  }
                  setNewName('');
                  setNewGrade('');
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setLoading(false);
                }
              }}
            >
              新規作成して自分を担任に
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
          ) : filtered.length === 0 ? (
            <p className="text-gray-600">該当クラスがありません。</p>
          ) : (
            <div className="divide-y">
              {filtered.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-gray-500">学年: {c.grade ?? '-'} / 担任: {c.teacher_id ? (c.teacher_id === currentUser?.id ? '自分' : '他の先生') : '未設定'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.teacher_id === currentUser?.id ? (
                      <Button variant="outline" size="sm" onClick={() => handleUnsetHomeroom(c.id)}>担任を外す</Button>
                    ) : (
                      <Button size="sm" onClick={() => handleSetHomeroom(c.id)}>自分を担任に</Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleAddManaged(c.id)}>副担当に追加</Button>
                    <Button variant="danger" size="sm" onClick={() => handleRemoveManaged(c.id)}>副担当を外す</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


