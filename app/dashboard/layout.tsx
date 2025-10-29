'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getTestPeriodsByClassId, getCurrentTestPeriod, getTestPeriodsByStudent } from '@/lib/supabase/test-periods';
import { getTodayTasks, getTaskStatistics, getIncompleTasks } from '@/lib/supabase/tasks';
import { TestPeriod, StudentProfile, Task, Statistics } from '@/types';
import Header from '@/components/dashboard/Header';
import MobileNavigation from '@/components/dashboard/MobileNavigation';
import Sidebar from '@/components/dashboard/Sidebar';
import MainContent from '@/components/dashboard/MainContent';
import { DashboardProvider } from '@/lib/context/DashboardContext';
import { SidebarProvider } from '@/lib/context/SidebarContext';
import { supabase } from '@/lib/supabase';

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile, currentUser, loading: authLoading } = useAuth();
  
  const [testPeriods, setTestPeriods] = useState<TestPeriod[]>([]);
  const [selectedTestPeriodId, setSelectedTestPeriodId] = useState<string>('');
  const [dashboardData, setDashboardData] = useState<{
    todayTasks: Task[];
    upcomingTasks: Task[];
    statistics: Statistics;
    totalUpcomingTasksCount: number; // 全明日以降タスク数
  } | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // 初回ロードのみtrue
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const [dataInitialized, setDataInitialized] = useState(false); // データ初期化フラグ

  // ログイン状態を監視し、未ログインならリダイレクト
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, authLoading, router]);

  // ユーザー情報が読み込めたら、テスト期間のリストを取得（初回のみ）
  useEffect(() => {
    console.log('[DashboardLayout] useEffect triggered with userProfile:', userProfile);
    if (!userProfile || dataInitialized) {
      console.log('[DashboardLayout] No userProfile or already initialized, skipping');
      return;
    }

    if (userProfile.role === 'student') {
      // 学生のテスト期間を読み込み（タスクベース: 実際に割り当てられたタスクがある期間のみ）
      (async () => {
        try {
          console.log('[DashboardLayout] Loading periods for student:', userProfile.id);
          const periods = await getTestPeriodsByStudent();
          console.log('[DashboardLayout] Periods loaded:', periods.length);
          setTestPeriods(periods);
          
          if (periods.length > 0) {
            const savedPeriodId = localStorage.getItem('selectedTestPeriodId');
            const defaultPeriodId = savedPeriodId && periods.find(p => p.id === savedPeriodId)
              ? savedPeriodId
              : periods[0].id;
            setSelectedTestPeriodId(defaultPeriodId);
            localStorage.setItem('selectedTestPeriodId', defaultPeriodId);
          }
          setDataInitialized(true);
        } catch (e) {
          console.error('[DashboardLayout] Failed to load test periods:', e);
        } finally {
          setIsDataLoading(false);
          setIsInitialLoad(false);
        }
      })();
    } else {
      console.log('[DashboardLayout] Non-student role, skipping data load');
      // 教師など学生以外のロールは学生用データロードをスキップし、即表示に切り替え
      setIsDataLoading(false);
      setIsInitialLoad(false);
      setDataInitialized(true);
    }
  }, [userProfile, dataInitialized]);
  
  // setup=complete で戻ってきたとき最新のテスト期間リストを再取得
  useEffect(() => {
    const setup = searchParams?.get('setup');
    if (setup === 'complete' && userProfile && userProfile.role === 'student') {
      // gradeIdを優先、なければclassIdを使用
      const periodIdentifier = (userProfile as StudentProfile).gradeId || (userProfile as StudentProfile).classId;
      if (periodIdentifier) {
        loadTestPeriods(periodIdentifier);
      }
    }
  }, [searchParams, userProfile]);

  


  const loadTestPeriods = async (gradeOrClassId: string) => {
    console.log('[DashboardLayout] Loading test periods for gradeOrClassId:', gradeOrClassId);
    try {
      const periods = await getTestPeriodsByClassId(gradeOrClassId);
      console.log('[DashboardLayout] Loaded test periods:', periods.length, 'items');
      setTestPeriods(periods);
      
      if (periods.length > 0) {
        // ローカルストレージから保存された選択を復元
        const savedPeriodId = localStorage.getItem('selectedTestPeriodId');
        const current = await getCurrentTestPeriod(gradeOrClassId);
        const defaultPeriodId = savedPeriodId && periods.find(p => p.id === savedPeriodId) 
          ? savedPeriodId 
          : current?.id || periods[0].id;
        console.log('[DashboardLayout] Setting selected test period:', defaultPeriodId);
        setSelectedTestPeriodId(defaultPeriodId);
        // 選択をローカルストレージに保存
        localStorage.setItem('selectedTestPeriodId', defaultPeriodId);
      } else {
        console.log('[DashboardLayout] No test periods found');
        // テスト期間が存在しない場合でも、空のダッシュボードを表示
        setDashboardData({
          todayTasks: [],
          upcomingTasks: [],
          statistics: {
            totalTasks: 0,
            completedTasks: 0,
            completionRate: 0,
            averageTimePerTask: 0,
            productivityScore: 0,
            weeklyProgress: [],
          },
          totalUpcomingTasksCount: 0,
        });
        setIsDataLoading(false);
      }
    } catch (error) {
      console.error('テスト期間の取得に失敗しました:', error);
      setIsDataLoading(false);
    }
  };

  // 選択中のテスト期間が変更されたら、ダッシュボードのデータを再取得
  const loadDashboardData = useCallback(async () => {
    
    // ユーザープロファイルが設定されていることを確認
    if (!userProfile || userProfile.role !== 'student') {
      // 学生以外のロールはローディングを解除してUI表示を継続
      setIsDataLoading(false);
      return;
    }

    // テスト期間が選択されていない場合は、空のデータでダッシュボードを表示
    if (!selectedTestPeriodId) {
      setDashboardData({
        todayTasks: [],
        upcomingTasks: [],
        statistics: {
          totalTasks: 0,
          completedTasks: 0,
          completionRate: 0,
          averageTimePerTask: 0,
          productivityScore: 0,
          weeklyProgress: [],
        },
        totalUpcomingTasksCount: 0,
      });
      setIsDataLoading(false);
      return;
    }

    setIsDataLoading(true);
    console.log('[loadDashboardData] Starting to load dashboard data...');
    try {
      const res = await fetch(`/api/dashboard/student?studentId=${encodeURIComponent(userProfile.id)}&periodId=${encodeURIComponent(selectedTestPeriodId)}`)
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const payload = await res.json()

      const weeklyProgress = Array.from({ length: 7 }).map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return {
          date: date.toISOString().split('T')[0],
          completed: Math.floor(Math.random() * 5) + 1,
          total: Math.floor(Math.random() * 8) + 3,
        };
      });

      const mappedStats: Statistics = {
        totalTasks: payload.statistics.total,
        completedTasks: payload.statistics.completed,
        completionRate: payload.statistics.completionRate,
        averageTimePerTask: 0,
        productivityScore: Math.min(100, Math.floor(payload.statistics.completionRate * 1.2)),
        weeklyProgress,
      };

      const allUpcomingTasks = (payload.incompleteTasks || []).filter((t: any) => !(payload.todayTasks || []).some((tt: any) => tt.id === t.id))

      setDashboardData({
        todayTasks: payload.todayTasks || [],
        upcomingTasks: allUpcomingTasks,
        statistics: mappedStats,
        totalUpcomingTasksCount: allUpcomingTasks.length,
      })
    } catch (error) {
      console.error('ダッシュボードデータの取得に失敗しました:', error);
      
      // ネットワークエラーの場合でも、空のデータで表示する
      if (!dashboardData) {
        setDashboardData({
          todayTasks: [],
          upcomingTasks: [],
          statistics: {
            totalTasks: 0,
            completedTasks: 0,
            completionRate: 0,
            averageTimePerTask: 0,
            productivityScore: 0,
            weeklyProgress: [],
          },
          totalUpcomingTasksCount: 0,
        });
      }
    } finally {
      setIsDataLoading(false);
    }
  }, [userProfile, selectedTestPeriodId]); // dashboardDataを依存配列から削除

  // React Query: キャッシュ＆自動再取得
  const queryEnabled = !!userProfile && userProfile.role === 'student' && !!selectedTestPeriodId
  const { data: rqData, isFetching, refetch } = useQuery({
    queryKey: ['student-dashboard', userProfile?.id, selectedTestPeriodId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/student?studentId=${encodeURIComponent(userProfile!.id)}&periodId=${encodeURIComponent(selectedTestPeriodId)}`)
      if (!res.ok) throw new Error(`API error ${res.status}`)
      return res.json()
    },
    enabled: queryEnabled,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!rqData) return;
    const weeklyProgress = Array.from({ length: 7 }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        date: date.toISOString().split('T')[0],
        completed: Math.floor(Math.random() * 5) + 1,
        total: Math.floor(Math.random() * 8) + 3,
      };
    });
    const mappedStats: Statistics = {
      totalTasks: rqData.statistics.total,
      completedTasks: rqData.statistics.completed,
      completionRate: rqData.statistics.completionRate,
      averageTimePerTask: 0,
      productivityScore: Math.min(100, Math.floor(rqData.statistics.completionRate * 1.2)),
      weeklyProgress,
    };
    const allUpcomingTasks = (rqData.incompleteTasks || []).filter((t: any) => !(rqData.todayTasks || []).some((tt: any) => tt.id === t.id))
    setDashboardData({
      todayTasks: rqData.todayTasks || [],
      upcomingTasks: allUpcomingTasks,
      statistics: mappedStats,
      totalUpcomingTasksCount: allUpcomingTasks.length,
    })
  }, [rqData])

  // Realtime: tasks テーブルの変更を購読して自動リフレッシュ
  useEffect(() => {
    if (!supabase || !userProfile || userProfile.role !== 'student' || !selectedTestPeriodId) {
      return;
    }

    const channel = supabase
      .channel('realtime-tasks-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload: any) => {
        try {
          const row = (payload.new || payload.old) as any;
          // 対象ユーザーかつ選択中テスト期間の変更のみ反映
          if (row && row.assigned_to === userProfile.id && row.test_period_id === selectedTestPeriodId) {
            console.log('[Realtime] tasks change detected -> reload');
            (async () => { try { await (refetch as any)?.() } catch {} })()
          }
        } catch {}
      })
      .subscribe();

    return () => {
      try { channel.unsubscribe(); } catch {}
    };
  }, [selectedTestPeriodId, userProfile, loadDashboardData, refetch]);

  // フォーカス時の二重再取得を避けるため、手動のfocusリスナーは撤去

  // クエリパラメータによるリフレッシュ指示に対応（初期化順序の競合を避けるためフラグ化）
  useEffect(() => {
    const refresh = searchParams?.get('refresh');
    if (refresh === '1') {
      console.log('[DashboardLayout] refresh=1 detected, reloading dashboard data');
      setPendingRefresh(true);
      // クエリを消して以降の再レンダリングでの再実行を防ぐ
      router.replace('/dashboard');
    }
  }, [searchParams, loadDashboardData, router]);

  // 選択中期間/ユーザーが揃ったタイミングで保留中のリフレッシュを実行
  useEffect(() => {
    if (pendingRefresh && selectedTestPeriodId && userProfile && userProfile.role === 'student') {
      console.log('[DashboardLayout] Executing pending refresh');
      loadDashboardData();
      setPendingRefresh(false);
    }
  }, [pendingRefresh, selectedTestPeriodId, userProfile, loadDashboardData]);

  const handleTestPeriodChange = (testPeriodId: string) => {
    setSelectedTestPeriodId(testPeriodId);
    // 選択をローカルストレージに保存
    localStorage.setItem('selectedTestPeriodId', testPeriodId);
  };

  const currentTestPeriod = testPeriods.find(p => p.id === selectedTestPeriodId) || null;
  
  // Dashboard layout render

  if (authLoading || (isInitialLoad && userProfile && userProfile.role === 'student' && !dashboardData)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SidebarProvider>
          <Header isLoading={true} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
        </SidebarProvider>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="bg-gray-50">
        <SidebarProvider>
          <Header isLoading={true} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
        </SidebarProvider>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      <SidebarProvider>
        <Header
          testPeriods={testPeriods}
          selectedTestPeriod={selectedTestPeriodId}
          onTestPeriodChange={handleTestPeriodChange}
        />
        
        <DashboardProvider value={{
          dashboardData,
          currentTestPeriod,
          isLoading: isDataLoading,
          onTaskUpdate: loadDashboardData,
          testPeriods,
          selectedTestPeriodId,
          onTestPeriodChange: handleTestPeriodChange
        }}>
          <div className="flex">
            <Sidebar />
            <MainContent>
              {children}
            </MainContent>
          </div>
          
          {/* モバイルナビゲーション */}
          <MobileNavigation />
          
        </DashboardProvider>
      </SidebarProvider>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
