'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useDashboard } from '@/lib/context/DashboardContext';
import { getTasksBySubject } from '@/lib/supabase/tasks';
import { getTestPeriod } from '@/lib/supabase/test-periods';
import { Task, TestPeriod } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface SubjectProgress {
  subject: string;
  totalTasks: number;
  completedTasks: number;
  progressRate: number;
}

export default function SubjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useAuth();
  const { currentTestPeriod } = useDashboard();
  const [subjectProgress, setSubjectProgress] = useState<SubjectProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTestPeriod, setSelectedTestPeriod] = useState<TestPeriod | null>(null);

  // URLパラメータからテスト期間を取得
  useEffect(() => {
    const periodId = searchParams.get('period');
    if (periodId) {
      getTestPeriod(periodId).then(period => {
        if (period) {
          setSelectedTestPeriod(period);
        }
      });
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadSubjectProgress() {
      const testPeriod = selectedTestPeriod || currentTestPeriod;
      
      if (!currentUser || !testPeriod) {
        setLoading(false);
        return;
      }

      try {
        const subjects = testPeriod.subjects || [];
        const progressData = await Promise.all(
          subjects.map(async (subject) => {
            const tasks = await getTasksBySubject(currentUser.id, subject, testPeriod.id);
            // メインタスクは除外して計算（詳細ページと同じロジック）
            const actionableTasks = tasks.filter(t => t.taskType !== 'parent');
            const completedTasks = actionableTasks.filter(t => t.status === 'completed').length;
            const totalTasks = actionableTasks.length;
            return {
              subject,
              totalTasks,
              completedTasks,
              progressRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            };
          })
        );

        setSubjectProgress(progressData);
      } catch (error) {
        console.error('科目別進捗の読み込みに失敗しました:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSubjectProgress();
  }, [currentUser, selectedTestPeriod, currentTestPeriod]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} variant="outlined">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const testPeriod = selectedTestPeriod || currentTestPeriod;
  
  if (!testPeriod) {
    return (
      <Card variant="elevated">
        <CardContent className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">テスト期間が設定されていません</h2>
          <p className="text-gray-600 mb-4">まずはテスト期間を設定してください。</p>
          <Button onClick={() => router.push('/dashboard/test-setup')}>
            テスト期間を設定する
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard')}
          >
            ← ダッシュボードに戻る
          </Button>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">科目別学習管理</h1>
          <p className="text-gray-600 mt-1">{testPeriod.title} の学習進捗</p>
        </div>
        <div className="hidden sm:flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard')}
          >
            ダッシュボード
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/tasks')}
          >
            全てのタスク
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/test-setup')}
          >
            テスト設定
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjectProgress.map((subject) => (
          <Card
            key={subject.subject}
            variant="outlined"
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push(`/dashboard/subjects/${encodeURIComponent(subject.subject)}?period=${testPeriod.id}`)}
          >
            <CardHeader>
              <CardTitle className="text-lg">{subject.subject}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 進捗バー */}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>進捗率</span>
                    <span className="font-medium">{subject.progressRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${subject.progressRate}%` }}
                    />
                  </div>
                </div>

                {/* タスク数 */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">タスク数</span>
                  <span className="font-medium text-gray-900">
                    {subject.completedTasks} / {subject.totalTasks} 完了
                  </span>
                </div>

                {/* アクションボタン */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dashboard/subjects/${encodeURIComponent(subject.subject)}?period=${testPeriod.id}`);
                  }}
                >
                  タスクを管理
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {subjectProgress.length === 0 && (
        <Card variant="outlined">
          <CardContent className="text-center py-12">
            <p className="text-gray-600">科目が登録されていません。</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}