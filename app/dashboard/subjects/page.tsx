'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useDashboard } from '@/lib/context/DashboardContext';
import { getTasksBySubject } from '@/lib/supabase/tasks';
import { getTestPeriod, getTestPeriodsByTeacherId } from '@/lib/supabase/test-periods';
import { fetchSchoolsWithGrades } from '@/lib/supabase/schools';
import { Task, TestPeriod, School, Grade } from '@/types';
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
  const { currentUser, userProfile } = useAuth();
  const { currentTestPeriod } = useDashboard();
  const [subjectProgress, setSubjectProgress] = useState<SubjectProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTestPeriod, setSelectedTestPeriod] = useState<TestPeriod | null>(null);
  const [teacherTestPeriods, setTeacherTestPeriods] = useState<TestPeriod[]>([]);
  const [schools, setSchools] = useState<(School & { grades: Grade[] })[]>([]);
  const [availableGrades, setAvailableGrades] = useState<Grade[]>([]);

  // 学校データの読み込み
  useEffect(() => {
    const loadSchools = async () => {
      try {
        const data = await fetchSchoolsWithGrades();
        setSchools(data);
      } catch (error) {
        console.error('学校データの読み込みに失敗:', error);
      }
    };

    if (userProfile?.role === 'teacher') {
      loadSchools();
    }
  }, [userProfile]);

  // 先生の場合は作成したテスト期間を取得
  useEffect(() => {
    if (userProfile?.role === 'teacher' && currentUser) {
      getTestPeriodsByTeacherId(currentUser.id).then(periods => {
        setTeacherTestPeriods(periods);
        // 最新のテスト期間を選択
        if (periods.length > 0) {
          setSelectedTestPeriod(periods[0]);
        }
      }).catch(error => {
        console.error('教師のテスト期間取得に失敗:', error);
      });
    }
  }, [userProfile, currentUser]);

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

  // テスト期間が変更されたときに学年データを更新
  useEffect(() => {
    if (selectedTestPeriod && schools.length > 0) {
      const school = schools.find(s => s.grades.some(g => g.id === selectedTestPeriod.classId));
      if (school) {
        setAvailableGrades(school.grades);
      }
    }
  }, [selectedTestPeriod, schools]);

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
            // 先生の場合は、そのテスト期間の全ユーザーのタスクを取得
            // 学生の場合は、自分のタスクのみを取得
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
    // 先生の場合は作成したテスト期間一覧を表示
    if (userProfile?.role === 'teacher') {
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
              <p className="text-gray-600 mt-1">テスト期間を選択してください</p>
            </div>
          </div>

          {teacherTestPeriods.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teacherTestPeriods.map((period) => (
                <Card
                  key={period.id}
                  variant="outlined"
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedTestPeriod(period)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{period.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        {new Date(period.startDate).toLocaleDateString('ja-JP')} ～ {new Date(period.endDate).toLocaleDateString('ja-JP')}
                      </p>
                      {period.subjects && period.subjects.length > 0 && (
                        <p className="text-sm text-gray-600">
                          科目: {period.subjects.join(', ')}
                        </p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTestPeriod(period);
                        }}
                      >
                        この期間を選択
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
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
          )}
        </div>
      );
    }

    // 学生の場合
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
          <div className="mt-1 space-y-1">
            {/* 階層的な表示 */}
            {userProfile?.role === 'teacher' && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">学校:</span> {schools.find(s => s.grades.some(g => g.id === testPeriod.classId))?.name || '不明'}
                <span className="mx-2">|</span>
                <span className="font-medium">学年:</span> {availableGrades.find(g => g.id === testPeriod.classId)?.name || '不明'}
                <span className="mx-2">|</span>
                <span className="font-medium">テスト期間:</span> {testPeriod.title}
              </div>
            )}
            <p className="text-gray-600">{testPeriod.title} の学習進捗</p>
            {userProfile?.role === 'teacher' && teacherTestPeriods.length > 1 && (
              <div className="mt-2">
                <select
                  value={testPeriod.id}
                  onChange={(e) => {
                    const selectedPeriod = teacherTestPeriods.find(p => p.id === e.target.value);
                    if (selectedPeriod) {
                      setSelectedTestPeriod(selectedPeriod);
                    }
                  }}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  {teacherTestPeriods.map(period => (
                    <option key={period.id} value={period.id}>
                      {period.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
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
                <div className="flex space-x-2">
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