'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Task, Statistics, TestPeriod } from '@/types';
import TaskList from '@/components/dashboard/TaskList';
import SubjectTaskAccordion from '@/components/dashboard/SubjectTaskAccordion';
import UpcomingTaskAccordion from '@/components/dashboard/UpcomingTaskAccordion';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getStudentsByPeriod, getTaskStatisticsForTeacher, getSubjectStatsForTeacher } from '@/lib/supabase/tasks';
import { getTestPeriodsByGradeNumber, getAllTestPeriodsForTeacher } from '@/lib/supabase/test-periods';
import { sendStamp } from '@/lib/supabase/encouragements';
import type { Grade, School } from '@/types';
import { supabase } from '@/lib/supabase';

interface DashboardPageProps {
  dashboardData: {
    todayTasks: Task[];
    upcomingTasks: Task[];
    statistics: Statistics;
    totalUpcomingTasksCount: number;
  } | null;
  currentTestPeriod: TestPeriod | null;
  isLoading: boolean;
  onTaskUpdate: () => void;
}

export default function DashboardPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { 
    dashboardData,
    currentTestPeriod,
    isLoading,
    onTaskUpdate
  } = useDashboard();
  const [stamps, setStamps] = useState<any[]>([]);

  // 教師用: 進捗スナップショット
  const [snapshot, setSnapshot] = useState<{ avgCompletion: number; students: number } | null>(null);
  // 教師用: ヘッダー選択と可視化データ
  const [selectedGradeNumber, setSelectedGradeNumber] = useState<number | 'all'>('all');
  const [periods, setPeriods] = useState<{ key: string; title: string }[]>([]);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [periodGroups, setPeriodGroups] = useState<Record<string, { id: string; startDate: string; classId: string }[]>>({});
  const [studentsProgress, setStudentsProgress] = useState<{ id: string; name: string; rate: number; total: number; done: number; gradeNumber?: number|null; schoolName?: string|null; subjects?: { subject: string; completionRate: number; total: number; completed: number }[] }[]>([]);
  const [schoolFilter, setSchoolFilter] = useState<string | 'all'>('all');
  const [availableSchoolOptions, setAvailableSchoolOptions] = useState<{ id: string | null; name: string }[]>([]);
  const [sendingStudentId, setSendingStudentId] = useState<string | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState<boolean>(false);
  const [periodsReloadTick, setPeriodsReloadTick] = useState(0);
  const [teacherRefreshTick, setTeacherRefreshTick] = useState(0);

  useEffect(() => {
    async function loadSnapshot() {
      if (userProfile?.role !== 'teacher') return;
      if (!selectedPeriodKey) return;
      try {
        const group = periodGroups?.[selectedPeriodKey] as { id: string }[] | undefined;
        const periodIds: string[] = (group || []).map(p => p.id);
        const allStudentsArrays = await Promise.all(periodIds.map(id => getStudentsByPeriod(id)));
        const mergedMap = new Map<string, any>();
        allStudentsArrays.flat().forEach(s => { if (!mergedMap.has(s.id)) mergedMap.set(s.id, s); });
        const students = Array.from(mergedMap.values());
        const primaryPeriodId = periodIds[0] || undefined;
        const stats = await Promise.all(students.map(s => getTaskStatisticsForTeacher(s.id, primaryPeriodId)));
        const avg = stats.length > 0 ? Math.round(stats.reduce((a, b) => a + b.completionRate, 0) / stats.length) : 0;
        setSnapshot({ avgCompletion: avg, students: students.length });
      } catch (e) {
        setSnapshot(null);
      }
    }
    loadSnapshot();
  }, [userProfile, selectedPeriodKey, periodGroups]);

  // 教師用: 学年フィルタ初期化（フィルタ用のみ、期間取得には影響しない）
  useEffect(() => {
    if (userProfile?.role !== 'teacher') return;
    const raw = typeof window !== 'undefined' ? (localStorage.getItem('teacher.selectedGradeNumber') || 'all') : 'all';
    const saved = raw === 'all' ? 'all' : Number(raw);
    setSelectedGradeNumber(saved === 'all' || [1,2,3].includes(saved as number) ? (saved as any) : 'all');
  }, [userProfile]);

  // 教師用: 年・期間の取得（全学年から取得、学年フィルタとは独立）
  useEffect(() => {
    if (userProfile?.role !== 'teacher') return;
    (async () => {
      setLoadingPeriods(true);

      // まずキャッシュを即時反映（白や空選択肢を避ける）
      try {
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('teacher.periodGroupsCache');
          if (cached) {
            const parsed = JSON.parse(cached) as { groups: Record<string, { id: string; startDate: string; classId: string }[]>; years: number[]; options: { key: string; title: string }[] };
            setPeriodGroups(parsed.groups);
            setAvailableYears(parsed.years || []);
            setPeriods(parsed.options || []);
            const currentYear = new Date().getFullYear();
            const savedYear = Number(localStorage.getItem('teacher.selectedYear')) || null;
            const defaultYear = savedYear || (parsed.years?.includes(currentYear) ? currentYear : (parsed.years?.[0] ?? null));
            setSelectedYear(defaultYear ?? null);
          }
        }
      } catch {}

      // 全学年のテスト期間を取得（RLSをバイパスして全期間取得）
      let list: any[] = [];
      try {
        // 教師は全学校の全テスト期間を見る必要があるため、
        // RLSが適用される getTestPeriodsByGradeNumber ではなく
        // supabaseAdmin を使う getAllTestPeriodsForTeacher を優先
        let attempts = 0;
        while (attempts < 5) {
          try {
            list = await getAllTestPeriodsForTeacher();
            if (list && list.length) break;
          } catch (e) {
            console.error('[loadPeriods] Failed:', e);
          }
          attempts++;
          await new Promise(r => setTimeout(r, 400));
        }
      } catch (e) {
        console.error('[loadPeriods] Error:', e);
        list = [];
      }

      // グルーピング: 年+タイトル -> 複数の期間ID
      const groups = new Map<string, any[]>();
      for (const p of list) {
        const y = new Date(p.startDate).getFullYear();
        const key = `${y}|${p.title}`;
        const arr = groups.get(key) || [];
        arr.push(p);
        groups.set(key, arr);
      }
      const unique = Array.from(groups.entries()).map(([key, arr]) => ({ key, sample: arr[0] }));

      const yrs = Array.from(new Set(unique.map((e: any) => new Date(e.sample.startDate).getFullYear()))).sort((a,b) => b-a);
      setAvailableYears(yrs);
      // デフォルト年: localStorage → 現在の年（あれば） → 最新年
      const currentYear = new Date().getFullYear();
      const savedYear = typeof window !== 'undefined' ? Number(localStorage.getItem('teacher.selectedYear')) : null;
      const defaultYear = savedYear || (yrs.includes(currentYear) ? currentYear : yrs[0]) || null;
      setSelectedYear(defaultYear);
      setPeriods(unique.map((e: any) => ({ key: e.key, title: e.sample.title })));
      const groupsObj = Object.fromEntries(Array.from(groups.entries()).map(([key, arr]) => [key, arr.map((p: any) => ({ id: p.id, startDate: p.startDate, classId: p.classId }))]));
      setPeriodGroups(groupsObj);
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('teacher.periodGroupsCache', JSON.stringify({
            groups: groupsObj,
            years: yrs,
            options: unique.map((e: any) => ({ key: e.key, title: e.sample.title })),
          }));
        }
      } catch {}
      setLoadingPeriods(false);
    })();
  }, [userProfile, periodsReloadTick]);

  useEffect(() => {
    // 年を変更したら期間の既定値を切り替え
    if (selectedYear == null) { setSelectedPeriodKey(null); return; }
    const listForYear = periodsForYear();
    // 以前選んだキーを復元、なければ先頭
    const savedKey = typeof window !== 'undefined' ? localStorage.getItem('teacher.selectedPeriodKey') : null;
    const exists = savedKey && listForYear.some(p => p.key === savedKey);
    setSelectedPeriodKey(exists ? (savedKey as string) : (listForYear[0]?.key ?? null));
    if (typeof window !== 'undefined') localStorage.setItem('teacher.selectedYear', String(selectedYear));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, periods.length]);

  const periodsForYear = () => {
    if (selectedYear == null) return periods;
    return periods.filter(p => {
      const srcFirst = periodGroups?.[p.key]?.[0]?.startDate as string | undefined;
      // フォールバック: タイトルに年があれば使う
      const yearInTitle = p.title.match(/\b(20\d{2})\b/);
      const y = srcFirst ? new Date(srcFirst).getFullYear() : (yearInTitle ? Number(yearInTitle[1]) : null);
      return y === selectedYear;
    });
  };

  // 教師用: 生徒進捗取得（年・期間選択後、学年・学校でフィルタ）
  useEffect(() => {
    if (userProfile?.role !== 'teacher') return;
    if (!selectedPeriodKey) { setStudentsProgress([]); setAvailableSchoolOptions([]); return; }
    
    // periodGroupsが空の場合はスキップ（初期化待ち）
    if (!periodGroups || Object.keys(periodGroups).length === 0) {
      return;
    }
    
    (async () => {
      // 選択されたグループ内のすべての期間IDで対象生徒を取得し、マージ
      const group = periodGroups?.[selectedPeriodKey] as { id: string }[] | undefined;
      const periodIds: string[] = (group || []).map(p => p.id);
      
      if (!periodIds || periodIds.length === 0) {
        setStudentsProgress([]);
        return;
      }
      
      const allStudentsArrays = await Promise.all(periodIds.map(id => getStudentsByPeriod(id)));
      
      const mergedMap = new Map<string, any>();
      allStudentsArrays.flat().forEach(s => { if (!mergedMap.has(s.id)) mergedMap.set(s.id, s); });
      const students = Array.from(mergedMap.values());
      
      // 学校フィルタ候補を先に抽出（全生徒から）
      const schoolOptsMap = new Map<string, string>();
      students.forEach(s => { if (s.schoolId && s.schoolName) schoolOptsMap.set(s.schoolId, s.schoolName); });
      setAvailableSchoolOptions(Array.from(schoolOptsMap.entries()).map(([id, name]) => ({ id, name })));

      // フィルタ: 学年番号/学校
      const filtered = students.filter(s => {
        const gradeOk = selectedGradeNumber === 'all' || s.gradeNumber === selectedGradeNumber;
        const schoolOk = schoolFilter === 'all' || s.schoolId === schoolFilter;
        return gradeOk && schoolOk;
      });
      
      // 複数期間IDをカンマ区切りで渡す
      const periodIdsParam = periodIds.join(',');
      
      const rows = await Promise.all(filtered.map(async s => {
        const [st, subj] = await Promise.all([
          getTaskStatisticsForTeacher(s.id, periodIdsParam),
          getSubjectStatsForTeacher(s.id, periodIdsParam),
        ]);
        return ({ id: s.id, name: s.displayName, rate: st.completionRate, total: st.total, done: st.completed, gradeNumber: s.gradeNumber ?? undefined, schoolName: s.schoolName ?? undefined, subjects: subj });
      }));
      
      setStudentsProgress(rows);
      
      // localStorageに学年フィルタを保存
      if (typeof window !== 'undefined') {
        localStorage.setItem('teacher.selectedGradeNumber', String(selectedGradeNumber));
      }
    })();
  }, [userProfile, selectedPeriodKey, selectedGradeNumber, schoolFilter, teacherRefreshTick, periodGroups]);

  // 教師用: タスク変更のリアルタイム購読で自動更新
  useEffect(() => {
    if (!supabase || userProfile?.role !== 'teacher') return;
    if (!selectedPeriodKey) return;
    const group = periodGroups?.[selectedPeriodKey] as { id: string }[] | undefined;
    const periodIds: string[] = (group || []).map(p => p.id);
    if (!periodIds.length) return;
    const channel = supabase
      .channel('realtime-tasks-teacher')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload: any) => {
        const row = (payload.new || payload.old) as any;
        if (!row) return;
        if (row.test_period_id && periodIds.includes(row.test_period_id)) {
          setTeacherRefreshTick(t => t + 1);
        }
      })
      .subscribe();
    return () => {
      try { channel.unsubscribe(); } catch {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, selectedPeriodKey, periodGroups]);

  const handleSendStamp = async (studentId: string, message: string) => {
    if (!userProfile?.id) return;
    try {
      setSendingStudentId(studentId);
      await sendStamp(userProfile.id, studentId, 'preset', message);
    } finally {
      setSendingStudentId(null);
    }
  };
  
  // Dashboard page render

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-3 bg-gray-200 rounded w-4/6"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 教師: ヘッダー選択 + スナップショット + 可視化
  if (!dashboardData && userProfile?.role === 'teacher') {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">管理者ダッシュボード</h1>
          <p className="text-blue-100">学年とテスト期間を選んで、対象生徒の進捗を確認・応援できます。</p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <div className="text-sm text-gray-600 mb-1">年</div>
            <select value={selectedYear ?? ''} onChange={(e) => setSelectedYear(Number(e.target.value))} className="border rounded px-3 py-2">
              {availableYears.length === 0 ? (
                <option value="" disabled>{loadingPeriods ? '読み込み中…' : 'データなし'}</option>
              ) : (
                availableYears.map(y => (
                  <option key={y} value={y}>{y}年</option>
                ))
              )}
            </select>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">テスト期間</div>
            <select value={selectedPeriodKey ?? ''} onChange={(e) => { const v = e.target.value || null; setSelectedPeriodKey(v); if (v && typeof window !== 'undefined') localStorage.setItem('teacher.selectedPeriodKey', v); }} className="border rounded px-3 py-2">
              {periodsForYear().length === 0 ? (
                <option value="" disabled>{loadingPeriods ? '読み込み中…' : 'データなし'}</option>
              ) : (
                periodsForYear().map(p => (
                  <option key={p.key} value={p.key}>{p.title}</option>
                ))
              )}
            </select>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">&nbsp;</div>
            <Button variant="outline" onClick={() => setPeriodsReloadTick(t => t + 1)} disabled={loadingPeriods}>
              {loadingPeriods ? '再取得中…' : '期間を再取得'}
            </Button>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">学年</div>
            <select value={selectedGradeNumber as any} onChange={(e) => setSelectedGradeNumber(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="border rounded px-3 py-2">
              <option value={'all'}>全学年</option>
              <option value={1}>1年生</option>
              <option value={2}>2年生</option>
              <option value={3}>3年生</option>
            </select>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">学校</div>
            <select value={schoolFilter as any} onChange={(e) => setSchoolFilter(e.target.value === 'all' ? 'all' : e.target.value)} className="border rounded px-3 py-2">
              <option value={'all'}>すべて</option>
              {availableSchoolOptions.map(opt => (
                <option key={opt.id ?? 'none'} value={opt.id ?? ''}>{opt.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border rounded-lg px-4 py-2">
          <div className="text-sm text-gray-700">対象生徒数 <span className="font-semibold text-gray-900">{snapshot?.students ?? 0}</span></div>
          <div className="text-sm text-gray-700">平均完了率 <span className="font-semibold text-gray-900">{snapshot?.avgCompletion ?? 0}%</span></div>
          <div className="ml-auto">
            <Button size="sm" onClick={() => router.push('/dashboard/progress-overview')}>進捗一覧（拡大）</Button>
          </div>
        </div>

        {/* 可視化: 学年×テスト期間の生徒進捗 */}
        <Card variant="elevated">
          <CardContent className="p-3 space-y-3">
            {studentsProgress.length === 0 ? (
              <div className="text-gray-600">該当する生徒が見つかりません。</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {studentsProgress.map(sp => (
                  <div key={sp.id} className="border rounded-lg p-2.5 bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{sp.name}</div>
                        <div className="text-xs text-gray-600 truncate">{sp.gradeNumber ? `${sp.gradeNumber}年生` : ''}{sp.gradeNumber && sp.schoolName ? '・' : ''}{sp.schoolName || ''}</div>
                      </div>
                      <div className="text-xs text-gray-600 whitespace-nowrap">{sp.done}/{sp.total}</div>
                    </div>
                    {/* 全体進捗バー */}
                    <div className="h-2 w-full bg-gray-100 rounded">
                      <div className="h-2 bg-green-500 rounded" style={{ width: `${sp.rate}%` }} />
                    </div>
                    <div className="text-[10px] text-gray-600 mt-0.5">全体 {sp.rate}%</div>
                    {/* 科目別進捗（コンパクト） */}
                    {sp.subjects && sp.subjects.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {sp.subjects.map((sj) => (
                          <div key={sp.id + sj.subject} className="flex items-center gap-2">
                            <div className="text-[11px] text-gray-700 w-20 truncate">{sj.subject}</div>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded">
                              <div className="h-1.5 bg-blue-500 rounded" style={{ width: `${sj.completionRate}%` }} />
                            </div>
                            <div className="text-[10px] text-gray-600 w-10 text-right">{sj.completionRate}%</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {['この調子！','よく頑張った！','あと少し！'].map(msg => (
                        <Button key={msg} size="sm" variant="outline" disabled={sendingStudentId===sp.id} onClick={() => handleSendStamp(sp.id, msg)}>
                          {msg}
                        </Button>
                      ))}
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

  if (!dashboardData) {
    // 学生の初期表示
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-700">データを読み込んでいます...</h2>
        <p className="text-gray-500 mt-2">しばらくお待ちください。</p>
        <div className="mt-4">
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            size="sm"
          >
            ページを再読み込み
          </Button>
        </div>
        <div className="mt-8">
          <Button
            onClick={() => router.push('/dashboard/test-setup')}
          >
            新しいテスト期間を設定する
          </Button>
        </div>
      </div>
    );
  }

  const { todayTasks, upcomingTasks, statistics, totalUpcomingTasksCount } = dashboardData;

  const quickStats = [
    {
      title: '今日のタスク',
      value: todayTasks.length,
      subtitle: `${todayTasks.filter(t => t.status === 'completed').length}件完了`,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: '総タスク数',
      value: statistics.totalTasks,
      subtitle: `${statistics.completedTasks}件完了`,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: '完了率',
      value: `${statistics.completionRate}%`,
      subtitle: currentTestPeriod ? currentTestPeriod.title : 'テスト期間未設定',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ウェルカムメッセージ */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          おかえりなさい、{userProfile?.displayName}さん！
        </h1>
        <p className="text-blue-100">
          {currentTestPeriod 
            ? `${currentTestPeriod.title}の準備を頑張りましょう！` 
            : 'テスト期間を設定して学習を開始しましょう。'
          }
        </p>
        {!currentTestPeriod && (
          <Button
            variant="secondary"
            onClick={() => router.push('/dashboard/test-setup')}
            className="mt-4"
          >
            テスト期間を設定する
          </Button>
        )}
      </div>

      {/* クイック統計 - モバイルでは横並び */}
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
        {quickStats.map((stat, index) => (
          <Card key={index} variant="elevated">
            <CardContent className={`${stat.bgColor} rounded-lg`}>
              <div className="text-center p-2 sm:p-4">
                <div className={`text-lg sm:text-2xl font-bold ${stat.color} mb-1`}>
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm font-medium text-gray-800 mb-1">
                  {stat.title}
                </div>
                <div className="text-xs text-gray-600 hidden sm:block">
                  {stat.subtitle}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 今日のタスク（科目別アコーディオン形式） */}
      <div>
        <SubjectTaskAccordion
          tasks={todayTasks}
          title="今日のタスク"
          onTaskUpdate={onTaskUpdate}
        />
      </div>

      {/* 明日以降のタスク（2段階アコーディオン形式） */}
      {upcomingTasks.length > 0 && (
        <UpcomingTaskAccordion
          tasks={upcomingTasks}
          title="明日以降のタスク"
          onTaskUpdate={onTaskUpdate}
          totalTaskCount={totalUpcomingTasksCount}
        />
      )}

      {/* アクションカードはサイドバーに移動 */}
    </div>
  );
}
