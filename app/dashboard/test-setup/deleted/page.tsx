'use client';

import { useEffect, useMemo, useState } from 'react';
import { listDeletedTestPeriods, restoreTestPeriod, hardDeleteTestPeriod } from '@/lib/supabase/test-periods';
import { useAuth } from '@/lib/hooks/useAuth';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import type { TestPeriod } from '@/types';

export default function DeletedTestPeriodsPage() {
  const { currentUser } = useAuth();
  const { onTaskUpdate, selectedTestPeriodId, testPeriods, onTestPeriodChange } = useDashboard();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TestPeriod[]>([]);
  const [error, setError] = useState<string>('');
  const [toast, setToast] = useState<string>('');
  const [confirm, setConfirm] = useState<{ id: string; title: string } | null>(null);

  const isAdmin = useMemo(() => currentUser?.role === 'teacher', [currentUser]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await listDeletedTestPeriods();
        setItems(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleRestore = async (id: string) => {
    try {
      await restoreTestPeriod(id);
      setItems(prev => prev.filter(p => p.id !== id));
      setToast('期間を復元しました');
      // 復元後にダッシュボードデータを更新
      onTaskUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleHardDelete = async (id: string) => {
    try {
      await hardDeleteTestPeriod(id);
      setItems(prev => prev.filter(p => p.id !== id));
      setToast('期間を完全に削除しました');
      // 選択中の期間を削除した場合は安全な期間へフェールバック
      if (selectedTestPeriodId === id) {
        const fallback = testPeriods.find(p => p.id !== id) || null;
        if (fallback) {
          onTestPeriodChange(fallback.id);
        } else {
          // 代替がない場合は選択解除（ダッシュボード側で安全に扱われる）
          onTestPeriodChange('');
        }
      }
      // データの再読込
      onTaskUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConfirm(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>権限がありません</CardTitle>
          </CardHeader>
          <CardContent>このページは管理者のみが閲覧できます。</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white text-sm px-4 py-2 rounded shadow">{toast}</div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>削除済みテスト期間</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>読み込み中...</p>
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-gray-600">削除済みの期間はありません。</p>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="p-3 border rounded flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-gray-600">{item.startDate} ~ {item.endDate}</p>
                    {item.deletedAt && (
                      <p className="text-xs text-gray-500">削除: {new Date(item.deletedAt).toLocaleString()}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleRestore(item.id)}>復元</Button>
                    <Button size="sm" variant="destructive" onClick={() => setConfirm({ id: item.id, title: item.title })}>完全削除</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>完全削除の確認</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>
                「{confirm.title}」を完全に削除します。関連タスクの移行や削除が必要な場合は事前に処理してください。
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setConfirm(null)}>キャンセル</Button>
                <Button variant="destructive" onClick={() => handleHardDelete(confirm.id)}>完全に削除</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

