'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { fetchSchoolsWithGrades } from '@/lib/supabase/schools';
import { getTestPeriodsByTeacherId, getTestPeriod } from '@/lib/supabase/test-periods';
import { getTasksBySubject, distributeTaskToStudents, getStudentsByGrade } from '@/lib/supabase/tasks';
import { School, Grade, TestPeriod, Task } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';

interface SubjectOverview {
  subject: string;
  taskCount: number;
  tasks: Task[];
  isConfigured: boolean;
}

export default function TaskDistributionV2Page() {
  const router = useRouter();
  const { currentUser, userProfile } = useAuth();
  
  const [schools, setSchools] = useState<(School & { grades: Grade[] })[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedTestPeriodId, setSelectedTestPeriodId] = useState('');
  const [availableGrades, setAvailableGrades] = useState<Grade[]>([]);
  const [availableTestPeriods, setAvailableTestPeriods] = useState<TestPeriod[]>([]);
  const [subjectOverviews, setSubjectOverviews] = useState<SubjectOverview[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [targetStudents, setTargetStudents] = useState<{ id: string; displayName: string; studentNumber?: string }[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [result, setResult] = useState<{ successCount: number; errorCount: number; errors: string[] } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // 保存・復元用キー
  const STORAGE_KEY = 'taskDistV2Selections';

  // 画面復帰時に選択状態を復元
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return;
      const saved = JSON.parse(raw) as { schoolId?: string; gradeId?: string; testPeriodId?: string };
      // 学校一覧が未ロードの間は適用を遅延
      if (!schools || schools.length === 0) return;
      // 有効な学校のみ反映
      if (saved?.schoolId && schools.some(s => s.id === saved.schoolId)) {
        setSelectedSchoolId(prev => prev || saved.schoolId!);
      }
      // 有効な学年のみ反映（学校が確定してから）
      const gradesInSchool = schools.find(s => s.id === (saved?.schoolId || selectedSchoolId))?.grades || [];
      if (saved?.gradeId && gradesInSchool.some(g => g.id === saved.gradeId)) {
        setSelectedGradeId(prev => prev || saved.gradeId!);
      }
      // テスト期間は学年が適用された後に、取得後のフィルタで保持されれば残す
      if (saved?.testPeriodId) {
        setSelectedTestPeriodId(prev => prev || saved.testPeriodId!);
      }
    } catch {}
    // schools が変わったタイミングでも復元を試みる
  }, [schools]);

  // 選択が変わったら保存
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const payload = JSON.stringify({
        schoolId: selectedSchoolId || undefined,
        gradeId: selectedGradeId || undefined,
        testPeriodId: selectedTestPeriodId || undefined,
      });
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch {}
  }, [selectedSchoolId, selectedGradeId, selectedTestPeriodId]);

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

  // 学校選択時の学年更新（既存選択が同一学校配下なら保持）
  useEffect(() => {
    if (selectedSchoolId && schools.length > 0) {
      const selectedSchool = schools.find(s => s.id === selectedSchoolId);
      if (selectedSchool) {
        setAvailableGrades(selectedSchool.grades);
        const gradeExistsInSchool = selectedGradeId && selectedSchool.grades.some(g => g.id === selectedGradeId);
        if (!gradeExistsInSchool) {
          setSelectedGradeId('');
          setSelectedTestPeriodId('');
          setSubjectOverviews([]);
          setTargetStudents([]);
        }
      }
    }
  }, [selectedSchoolId, schools]);

  // 学年選択時のテスト期間更新（生徒取得はテスト期間選択後に実施）
  useEffect(() => {
    if (selectedGradeId && currentUser) {
      const loadTestPeriodsAndStudents = async () => {
        try {
          // 先にテスト期間一覧を取得
          const periods = await getTestPeriodsByTeacherId(currentUser.id);
          const filteredPeriods = periods.filter(period => period.classId === selectedGradeId);
          setAvailableTestPeriods(filteredPeriods);
          // 既存のテスト期間選択がフィルタ後に存在しない場合のみリセットし、そのときだけ科目概要をクリア
          const testPeriodStillValid = selectedTestPeriodId && filteredPeriods.some(p => p.id === selectedTestPeriodId);
          if (!testPeriodStillValid) {
            setSelectedTestPeriodId('');
            setSubjectOverviews([]);
          }

          // 生徒一覧はキャッシュ優先（sessionStorage）
          const cacheKey = `students:${selectedGradeId}`;
          let usedCache = false;
          try {
            const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(cacheKey) : null;
            if (raw) {
              const cached = JSON.parse(raw) as { id: string; displayName: string; studentNumber?: string }[];
              if (Array.isArray(cached) && cached.length >= 0) {
                setTargetStudents(cached);
                usedCache = true;
              }
            }
          } catch {}

          setStudentsLoading(!usedCache);
          try {
            const fresh = await getStudentsByGrade(selectedGradeId);
            setTargetStudents(fresh);
            try {
              if (typeof window !== 'undefined') {
                window.sessionStorage.setItem(cacheKey, JSON.stringify(fresh));
              }
            } catch {}
          } catch (e) {
            console.error('生徒の取得に失敗:', e);
            if (!usedCache) setTargetStudents([]);
          } finally {
            setStudentsLoading(false);
          }
        } catch (error) {
          console.error('データの取得に失敗:', error);
        }
      };

      loadTestPeriodsAndStudents();
    } else {
      setAvailableTestPeriods([]);
      setTargetStudents([]);
    }
  }, [selectedGradeId, currentUser]);

  // テスト期間選択では生徒再取得を行わない（学年変更時のみ取得）

  // テスト期間選択時の科目概要取得
  useEffect(() => {
    if (selectedTestPeriodId && selectedGradeId) {
      const loadSubjectOverviews = async () => {
        setLoading(true);
        try {
          const testPeriod = await getTestPeriod(selectedTestPeriodId);
          if (!testPeriod) return;

          const subjects = testPeriod.subjects || [];
          const overviews: SubjectOverview[] = [];

          for (const subject of subjects) {
            try {
              // 講師の場合は共有タスクのみを取得
              const tasks = await getTasksBySubject(currentUser!.id, subject, selectedTestPeriodId, true);

              overviews.push({
                subject,
                taskCount: tasks.length,
                tasks: tasks,
                isConfigured: tasks.length > 0
              });
            } catch (error) {
              console.error(`${subject}のタスク取得に失敗:`, error);
              overviews.push({
                subject,
                taskCount: 0,
                tasks: [],
                isConfigured: false
              });
            }
          }

          setSubjectOverviews(overviews);
        } catch (error) {
          console.error('科目概要の取得に失敗:', error);
        } finally {
          setLoading(false);
        }
      };

      loadSubjectOverviews();
    }
  }, [selectedTestPeriodId, selectedGradeId, currentUser]);

  // 科目選択の切り替え
  const handleSubjectToggle = (subject: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subject) 
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
  };

  // 全選択/選択切替
  const toggleStudent = (id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectAll = () => {
    if (selectedStudentIds.length === targetStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(targetStudents.map(s => s.id));
    }
  };

  // 配布実行
  const handleDistribute = async () => {
    if (!currentUser || !selectedTestPeriodId || selectedSubjects.length === 0) return;

    setDistributing(true);
    setResult(null);

    try {
      // 選択された生徒がいない場合は中断
      const selectedTargets = targetStudents.filter(s => selectedStudentIds.includes(s.id));
      if (selectedTargets.length === 0) {
        setResult({ successCount: 0, errorCount: 0, errors: ['生徒が選択されていません'] });
        return;
      }
      let totalSuccessCount = 0;
      let totalErrorCount = 0;
      const allErrors: string[] = [];

      // 選択された各科目のタスクを配布
      for (const subjectOverview of subjectOverviews.filter(so => selectedSubjects.includes(so.subject))) {
        // メインタスクのみを配布（サブタスクは除外）
        const parentTasks = subjectOverview.tasks.filter(task => task.taskType === 'parent');
        
        for (const task of parentTasks) {
          try {
            const result = await distributeTaskToStudents({
              taskId: task.id,
              gradeId: selectedGradeId,
              targetStudents: selectedTargets.map(s => ({ id: s.id, displayName: s.displayName })),
            });

            totalSuccessCount += result.successCount;
            totalErrorCount += result.errorCount;
            allErrors.push(...result.errors.map(error => `${task.subject} - ${task.title}: ${error}`));
          } catch (error) {
            totalErrorCount += 1; // 仮の生徒数
            allErrors.push(`${task.subject} - ${task.title}: 配布に失敗しました`);
          }
        }
      }

      setResult({
        successCount: totalSuccessCount,
        errorCount: totalErrorCount,
        errors: allErrors
      });

      // 成功モーダルを表示（成功件数が1件以上なら成功扱い）
      if (totalSuccessCount > 0 && totalErrorCount === 0) {
        setShowSuccessModal(true);
      } else if (totalSuccessCount > 0 && totalErrorCount > 0) {
        // 部分成功でも通知
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error('タスク配布に失敗:', error);
      setResult({
        successCount: 0,
        errorCount: 1,
        errors: ['タスク配布に失敗しました']
      });
    } finally {
      setDistributing(false);
    }
  };

  // 先生以外はアクセス拒否
  if (userProfile?.role !== 'teacher') {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-700">アクセス権限がありません</h2>
        <p className="text-gray-500 mt-2">このページは先生のみアクセスできます。</p>
        <Button onClick={() => router.push('/dashboard')} className="mt-4">
          ダッシュボードに戻る
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">タスク配布</h1>
          <p className="text-gray-600 mt-1">科目別設定したタスクを生徒に配布します</p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard')}
        >
          ダッシュボードに戻る
        </Button>
      </div>

      {/* 選択ステップ */}
      <Card>
        <CardHeader>
          <CardTitle>配布対象の選択</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 学校選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">中学校を選択してください</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
            >
              <option value="">学校を選択</option>
              {schools.map(school => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          {/* 学年選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">その学年を選択してください</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(e.target.value)}
              disabled={!selectedSchoolId}
            >
              <option value="">学年を選択</option>
              {availableGrades.map(grade => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </div>

          {/* テスト期間選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">テスト期間を選択してください</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={selectedTestPeriodId}
              onChange={(e) => setSelectedTestPeriodId(e.target.value)}
              disabled={!selectedGradeId}
            >
              <option value="">テスト期間を選択</option>
              {availableTestPeriods.map(period => (
                <option key={period.id} value={period.id}>
                  {period.title}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* 配布対象の生徒表示 */}
      {selectedGradeId && (studentsLoading || targetStudents.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>配布対象の生徒</CardTitle>
                {!studentsLoading && (
                  <p className="text-sm text-gray-600 mt-1">{targetStudents.length}名の生徒</p>
                )}
              </div>
              {!studentsLoading && targetStudents.length > 0 && (
                <div className="flex items-center space-x-3">
                  <label className="inline-flex items-center space-x-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedStudentIds.length === targetStudents.length}
                      onChange={toggleSelectAll}
                    />
                    <span>全選択</span>
                  </label>
                  <span className="text-sm text-gray-500">
                    選択中: {selectedStudentIds.length}名
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {studentsLoading ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">生徒情報を読み込み中...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {targetStudents.map((student) => (
                  <div key={student.id} className="flex items-center space-x-3 p-3 border rounded-lg bg-gray-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedStudentIds.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                    />
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {student.displayName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{student.displayName}</p>
                      {student.studentNumber && (
                        <p className="text-sm text-gray-500">学籍番号: {student.studentNumber}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 科目概要表示 */}
      {selectedTestPeriodId && (
        <Card>
          <CardHeader>
            <CardTitle>科目別設定内容</CardTitle>
            <p className="text-sm text-gray-600 mt-1">配布したい科目を選択してください</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">科目設定を読み込み中...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjectOverviews.map((overview) => (
                  <div
                    key={overview.subject}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedSubjects.includes(overview.subject)
                        ? 'border-blue-500 bg-blue-50'
                        : overview.isConfigured
                        ? 'border-green-300 bg-green-50 hover:border-green-400'
                        : 'border-gray-300 bg-gray-50'
                    }`}
                    onClick={() => overview.isConfigured && handleSubjectToggle(overview.subject)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900">{overview.subject}</h3>
                      <div className={`w-3 h-3 rounded-full ${
                        overview.isConfigured ? 'bg-green-500' : 'bg-gray-300'
                      }`}></div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      {overview.isConfigured ? (
                        <span>{overview.taskCount}個のタスクが設定済み</span>
                      ) : (
                        <span className="text-gray-500">設定未完了</span>
                      )}
                    </div>

                    {overview.isConfigured && (
                      <div className="space-y-1">
                        {overview.tasks.slice(0, 3).map((task, index) => (
                          <div key={index} className="text-xs text-gray-600 truncate">
                            • {task.title}
                          </div>
                        ))}
                        {overview.tasks.length > 3 && (
                          <div className="text-xs text-gray-500">
                            ...他{overview.tasks.length - 3}件
                          </div>
                        )}
                      </div>
                    )}

                    {!overview.isConfigured && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/subject-settings/${encodeURIComponent(overview.subject)}?period=${selectedTestPeriodId}`);
                        }}
                      >
                        設定する
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 配布ボタン */}
      {selectedSubjects.length > 0 && targetStudents.length > 0 && (
        <Card>
          <CardContent className="text-center py-6">
            <div className="mb-4">
              <p className="text-lg font-medium text-gray-900">
                選択された科目: {selectedSubjects.join(', ')}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {selectedSubjects.length}科目のタスクを{selectedStudentIds.length}名の生徒に配布します
              </p>
            </div>
            
            <Button
              onClick={handleDistribute}
              disabled={distributing || selectedStudentIds.length === 0}
              className="w-full max-w-md"
            >
              {distributing ? '配布中...' : '配布する'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 配布結果 */}
      {result && (
        <Card id="distribution-result">
          <CardHeader>
            <CardTitle>配布結果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-4 bg-green-50 rounded">
                <p className="text-2xl font-bold text-green-600">{result.successCount}</p>
                <p className="text-sm text-green-700">成功</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded">
                <p className="text-2xl font-bold text-red-600">{result.errorCount}</p>
                <p className="text-sm text-red-700">失敗</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">エラー詳細:</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((error, index) => (
                    <p key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex space-x-2">
              <Button
                onClick={() => {
                  setResult(null);
                  setSelectedSubjects([]);
                }}
                variant="outline"
              >
                新しい配布を行う
              </Button>
              <Button onClick={() => router.push('/dashboard')}>
                ダッシュボードに戻る
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 配布完了モーダル */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="text-center">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">タスク配布が完了しました</h3>
              <p className="mt-1 text-sm text-gray-600">生徒のダッシュボードにタスクが反映されます。</p>
              {result && (
                <p className="mt-2 text-sm text-gray-700">成功 {result.successCount} / 失敗 {result.errorCount}</p>
              )}
            </div>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSuccessModal(false);
                }}
              >
                閉じる
              </Button>
              <Button
                onClick={() => {
                  setShowSuccessModal(false);
                  // 配布結果セクションへスクロール
                  const el = document.querySelector('#distribution-result');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                配布結果を見る
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
