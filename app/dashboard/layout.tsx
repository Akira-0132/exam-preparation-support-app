'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getTestPeriodsByClassId, getCurrentTestPeriod, getTestPeriodsByStudent } from '@/lib/supabase/test-periods';
import { TestPeriod, StudentProfile, Task, Statistics } from '@/types';
import Header from '@/components/dashboard/Header';
import MobileNavigation from '@/components/dashboard/MobileNavigation';
import Sidebar from '@/components/dashboard/Sidebar';
import MainContent from '@/components/dashboard/MainContent';
import { DashboardProvider } from '@/lib/context/DashboardContext';
import { SidebarProvider } from '@/lib/context/SidebarContext';
import { supabase } from '@/lib/supabase';
import { DebugPanel } from '@/components/debug/DebugPanel';

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile, currentUser, loading: authLoading } = useAuth();
  
  const [testPeriods, setTestPeriods] = useState<TestPeriod[]>([]);
  
  // 初期化時にキャッシュから復元
  const [selectedTestPeriodId, setSelectedTestPeriodId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem('selectedTestPeriodId') || '';
    } catch {
      return '';
    }
  });
  
  const [dashboardData, setDashboardData] = useState<{
    todayTasks: Task[];
    upcomingTasks: Task[];
    statistics: Statistics;
    totalUpcomingTasksCount: number;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('dashboardDataCache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const isRecent = Date.now() - parsed.timestamp < 15 * 60 * 1000;
        if (isRecent && parsed.data) {
          console.log('[DashboardLayout] Restored from cache on init');
          return parsed.data;
        }
      }
    } catch (e) {
      console.warn('[DashboardLayout] Cache init error:', e);
    }
    return null;
  });

  // ローディング状態を簡素化：認証中 OR (学生 AND データなし AND 期間取得中またはクエリ実行中)
  const [testPeriodsLoading, setTestPeriodsLoading] = useState(false);

  // ログイン状態を監視
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, authLoading, router]);

  // キャッシュ検証（userProfile取得後）
  useEffect(() => {
    if (!userProfile || typeof window === 'undefined') return;
    
    try {
      const cached = localStorage.getItem('dashboardDataCache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const isRecent = Date.now() - parsed.timestamp < 15 * 60 * 1000;
        const isMatch = parsed.userId === userProfile.id;
        
        if (isMatch && isRecent && !dashboardData) {
          console.log('[DashboardLayout] Validating cache - restoring');
          setDashboardData(parsed.data);
          if (parsed.periodId && !selectedTestPeriodId) {
            setSelectedTestPeriodId(parsed.periodId);
          }
        } else if (!isMatch && dashboardData) {
          console.log('[DashboardLayout] Clearing wrong user cache');
          localStorage.removeItem('dashboardDataCache');
          setDashboardData(null);
        } else if (!isRecent) {
          localStorage.removeItem('dashboardDataCache');
        }
      }
    } catch (e) {
      console.warn('[DashboardLayout] Cache validation error:', e);
    }
  }, [userProfile?.id, dashboardData, selectedTestPeriodId]);

  // テスト期間の取得（学生のみ、初回のみ）
  useEffect(() => {
    if (!userProfile || userProfile.role !== 'student' || testPeriods.length > 0) {
      if (userProfile && userProfile.role === 'student') {
        console.log('[DashboardLayout] Skipping test periods load:', {
          hasUserProfile: !!userProfile,
          role: userProfile.role,
          testPeriodsLength: testPeriods.length,
        });
      }
      return;
    }
    
    let isMounted = true;
    const abortController = new AbortController();
    
    (async () => {
      try {
        setTestPeriodsLoading(true);
        console.log('[DashboardLayout] Loading test periods for student:', userProfile.id);
        
        // タイムアウト設定（10秒）
        const timeoutId = setTimeout(() => {
          if (isMounted) {
            console.warn('[DashboardLayout] Test periods loading timeout (10s)');
            abortController.abort();
            setTestPeriodsLoading(false);
            setTestPeriods([]);
          }
        }, 10000);
        
        try {
          console.log('[DashboardLayout] About to call getTestPeriodsByStudent');
          const periods = await getTestPeriodsByStudent();
          clearTimeout(timeoutId);
          
          if (!isMounted) {
            console.log('[DashboardLayout] Component unmounted, skipping state update');
            return;
          }
          
          console.log('[DashboardLayout] Loaded periods:', periods.length, periods);
          setTestPeriods(periods);
          
          if (periods.length > 0) {
            const savedPeriodId = localStorage.getItem('selectedTestPeriodId');
            const defaultPeriodId = (savedPeriodId && periods.find(p => p.id === savedPeriodId))
              ? savedPeriodId
              : periods[0].id;
            console.log('[DashboardLayout] Setting selectedPeriodId:', defaultPeriodId);
            setSelectedTestPeriodId(defaultPeriodId);
            localStorage.setItem('selectedTestPeriodId', defaultPeriodId);
          } else {
            // テスト期間がない場合は空データで表示
            console.warn('[DashboardLayout] No test periods found - showing empty dashboard');
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
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          console.error('[DashboardLayout] Error in getTestPeriodsByStudent:', fetchError);
          console.error('[DashboardLayout] Error in getTestPeriodsByStudent - details:', {
            message: fetchError instanceof Error ? fetchError.message : String(fetchError),
            name: fetchError instanceof Error ? fetchError.name : typeof fetchError,
            stack: fetchError instanceof Error ? fetchError.stack : undefined,
          });
          if (fetchError.name === 'AbortError' || fetchError.message === 'Test periods fetch aborted') {
            console.warn('[DashboardLayout] Test periods fetch aborted');
            return;
          }
          throw fetchError;
        }
      } catch (e) {
        console.error('[DashboardLayout] Failed to load periods:', e);
        console.error('[DashboardLayout] Failed to load periods - details:', {
          message: e instanceof Error ? e.message : String(e),
          name: e instanceof Error ? e.name : typeof e,
          stack: e instanceof Error ? e.stack : undefined,
        });
        if (!isMounted) return;
        
        // エラー時も空データで表示
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
        setTestPeriods([]);
      } finally {
        if (isMounted) {
          setTestPeriodsLoading(false);
          console.log('[DashboardLayout] Test periods loading completed, testPeriodsLoading:', false);
        }
      }
    })();
    
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [userProfile?.id, userProfile?.role, testPeriods.length]);

  // React Query: データ取得（単一のデータソース）
  const effectivePeriodId = selectedTestPeriodId || (typeof window !== 'undefined' ? localStorage.getItem('selectedTestPeriodId') || '' : '');
  const queryEnabled = !!userProfile && userProfile.role === 'student' && !!effectivePeriodId && !testPeriodsLoading;
  
  // デバッグログ
  useEffect(() => {
    console.log('[DashboardLayout] State:', {
      authLoading,
      userProfile: userProfile?.id,
      role: userProfile?.role,
      selectedTestPeriodId,
      effectivePeriodId,
      queryEnabled,
      dashboardData: !!dashboardData,
      testPeriodsLoading,
    });
  }, [authLoading, userProfile?.id, userProfile?.role, selectedTestPeriodId, effectivePeriodId, queryEnabled, dashboardData, testPeriodsLoading]);
  
  const { data: rqData, isFetching, refetch, error: queryError } = useQuery({
    queryKey: ['student-dashboard', userProfile?.id, effectivePeriodId],
    queryFn: async () => {
      console.log('[DashboardLayout] Query executing:', { effectivePeriodId, userId: userProfile?.id });
      if (!effectivePeriodId || !userProfile) throw new Error('Missing required params');
      const res = await fetch(`/api/dashboard/student?studentId=${encodeURIComponent(userProfile.id)}&periodId=${encodeURIComponent(effectivePeriodId)}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      console.log('[DashboardLayout] Query success:', data);
      return data;
    },
    enabled: queryEnabled,
    staleTime: 60_000,
    retry: 2,
    retryDelay: 1000,
  });
  
  // React Queryの状態をログに出力
  useEffect(() => {
    console.log('[DashboardLayout] React Query state:', {
      isFetching,
      hasData: !!rqData,
      error: queryError?.message,
      queryEnabled,
    });
  }, [isFetching, rqData, queryError, queryEnabled]);

  // React Query データを dashboardData に反映
  useEffect(() => {
    if (!rqData) return;
    
    // APIレスポンスのタスクデータをTask型にマッピング（due_date -> dueDateなど）
    const mapTaskFromAPI = (data: any): Task => ({
      id: data.id,
      title: data.title,
      description: data.description || '',
      subject: data.subject,
      priority: data.priority,
      status: data.status,
      dueDate: data.due_date || data.dueDate, // APIレスポンスはdue_date、既にマッピング済みの場合はdueDate
      startDate: data.start_date || data.startDate,
      estimatedTime: data.estimated_time || data.estimatedTime,
      actualTime: data.actual_time || data.actualTime,
      testPeriodId: data.test_period_id || data.testPeriodId,
      assignedTo: data.assigned_to || data.assignedTo,
      createdBy: data.created_by || data.createdBy,
      createdAt: data.created_at || data.createdAt,
      updatedAt: data.updated_at || data.updatedAt,
      completedAt: data.completed_at || data.completedAt,
      parentTaskId: data.parent_task_id || data.parentTaskId,
      taskType: (data.task_type || data.taskType || 'single') as 'single' | 'parent' | 'subtask',
      totalUnits: data.total_units || data.totalUnits,
      completedUnits: data.completed_units || data.completedUnits || 0,
      unitType: (data.unit_type || data.unitType || 'pages') as 'pages' | 'problems' | 'hours' | 'sections',
      cycleNumber: data.cycle_number || data.cycleNumber,
      learningStage: data.learning_stage || data.learningStage,
      isShared: data.is_shared || data.isShared || false,
    } as Task);
    
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
    
    // タスクデータをマッピング
    const mappedTodayTasks = (rqData.todayTasks || []).map(mapTaskFromAPI);
    const mappedIncompleteTasks = (rqData.incompleteTasks || []).map(mapTaskFromAPI);
    
    const allUpcomingTasks = mappedIncompleteTasks.filter(
      (t: Task) => !mappedTodayTasks.some((tt: Task) => tt.id === t.id)
    );
    
    setDashboardData({
      todayTasks: mappedTodayTasks,
      upcomingTasks: allUpcomingTasks,
      statistics: mappedStats,
      totalUpcomingTasksCount: allUpcomingTasks.length,
    });
  }, [rqData]);

  // キャッシュ保存
  useEffect(() => {
    if (!dashboardData || !userProfile) return;
    try {
      localStorage.setItem('dashboardDataCache', JSON.stringify({
        data: dashboardData,
        timestamp: Date.now(),
        userId: userProfile.id,
        periodId: selectedTestPeriodId,
      }));
    } catch (e) {
      console.warn('[DashboardLayout] Cache save error:', e);
    }
  }, [dashboardData, userProfile?.id, selectedTestPeriodId]);

  // React Query エラー時のフォールバック
  useEffect(() => {
    if (queryError && !dashboardData && userProfile) {
      console.warn('[DashboardLayout] Query error, checking cache:', queryError);
      try {
        const cached = localStorage.getItem('dashboardDataCache');
        if (cached) {
          const parsed = JSON.parse(cached);
          const isRecent = Date.now() - parsed.timestamp < 10 * 60 * 1000;
          const isMatch = parsed.userId === userProfile.id && parsed.periodId === effectivePeriodId;
          
          if (isRecent && isMatch) {
            console.log('[DashboardLayout] Restoring from cache after error');
            setDashboardData(parsed.data);
          }
        }
      } catch (e) {
        console.warn('[DashboardLayout] Cache restore error:', e);
      }
    }
  }, [queryError, dashboardData, userProfile?.id, effectivePeriodId]);

  // タイムアウト処理：3秒後に強制表示（期間が設定されていない場合も考慮）
  useEffect(() => {
    if (authLoading || !userProfile) return;
    if (userProfile.role !== 'student' || dashboardData) return;
    
    console.log('[DashboardLayout] Setting up timeout');
    const timeoutId = setTimeout(() => {
      console.warn('[DashboardLayout] Loading timeout (3s) - forcing display');
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
    }, 3000);
    
    return () => {
      console.log('[DashboardLayout] Clearing timeout');
      clearTimeout(timeoutId);
    };
  }, [authLoading, userProfile?.role, dashboardData]);

  // Realtime購読
  useEffect(() => {
    if (!supabase || !userProfile || userProfile.role !== 'student' || !selectedTestPeriodId) {
      return;
    }

    let refetchTimeoutId: NodeJS.Timeout | null = null;

    const channel = supabase
      .channel('realtime-tasks-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload: any) => {
        try {
          const row = (payload.new || payload.old) as any;
          console.log('[Realtime] Payload received:', {
            eventType: payload.eventType,
            event: payload.event,
            hasNew: !!payload.new,
            hasOld: !!payload.old,
            newStatus: payload.new?.status,
            oldStatus: payload.old?.status,
            rowAssignedTo: row?.assigned_to,
            rowTestPeriodId: row?.test_period_id,
          });
          
          if (row && row.assigned_to === userProfile.id && row.test_period_id === selectedTestPeriodId) {
            // タスク完了の場合は、完了エフェクト表示後にrefetchする（3秒遅延）
            const isTaskCompleted = payload.new?.status === 'completed' && 
                                   (payload.eventType === 'UPDATE' || payload.event === 'UPDATE');
            
            if (isTaskCompleted) {
              console.log('[Realtime] Task completed, scheduling delayed refetch (3s)');
              if (refetchTimeoutId) {
                clearTimeout(refetchTimeoutId);
              }
              refetchTimeoutId = setTimeout(() => {
                console.log('[Realtime] Executing delayed refetch after task completion');
                refetch();
                refetchTimeoutId = null;
              }, 3000);
            } else {
              // その他の変更は即座にrefetch
              console.log('[Realtime] Tasks changed, refetching immediately');
              if (refetchTimeoutId) {
                clearTimeout(refetchTimeoutId);
                refetchTimeoutId = null;
              }
              refetch();
            }
          }
        } catch (e) {
          console.error('[Realtime] Error handling change:', e);
        }
      })
      .subscribe();

    return () => {
      if (refetchTimeoutId) {
        clearTimeout(refetchTimeoutId);
      }
      try { channel.unsubscribe(); } catch {}
    };
  }, [selectedTestPeriodId, userProfile?.id, refetch]);

  // setup=complete ハンドラ
  useEffect(() => {
    const setup = searchParams?.get('setup');
    if (setup === 'complete' && userProfile?.role === 'student') {
      const periodIdentifier = (userProfile as StudentProfile).gradeId || (userProfile as StudentProfile).classId;
      if (periodIdentifier) {
        loadTestPeriods(periodIdentifier);
      }
    }
  }, [searchParams, userProfile]);

  const loadTestPeriods = async (gradeOrClassId: string) => {
    try {
      const periods = await getTestPeriodsByClassId(gradeOrClassId);
      setTestPeriods(periods);
      
      if (periods.length > 0) {
        const savedPeriodId = localStorage.getItem('selectedTestPeriodId');
        const current = await getCurrentTestPeriod(gradeOrClassId);
        const defaultPeriodId = (savedPeriodId && periods.find(p => p.id === savedPeriodId))
          ? savedPeriodId
          : current?.id || periods[0].id;
        setSelectedTestPeriodId(defaultPeriodId);
        localStorage.setItem('selectedTestPeriodId', defaultPeriodId);
      }
    } catch (error) {
      console.error('Failed to load test periods:', error);
    }
  };

  const handleTestPeriodChange = (testPeriodId: string) => {
    setSelectedTestPeriodId(testPeriodId);
    localStorage.setItem('selectedTestPeriodId', testPeriodId);
  };

  const currentTestPeriod = testPeriods.find(p => p.id === selectedTestPeriodId) || null;
  
  // ローディング表示条件を簡素化
  // 認証中 OR (学生 AND データなし AND (期間取得中 OR クエリ実行中))
  // ただし、データがある場合は認証完了を待たずに表示
  const shouldShowLoading = (
    authLoading && !dashboardData // 認証中でもデータがあれば表示
  ) || (
    userProfile?.role === 'student' &&
    !dashboardData &&
    (testPeriodsLoading || (queryEnabled && isFetching))
  );
  
  // windowオブジェクトにデバッグ情報を保存（ブラウザコンソールで確認可能）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    (window as any).__DASHBOARD_DEBUG__ = {
      authLoading,
      userProfile: userProfile ? { id: userProfile.id, role: userProfile.role } : null,
      selectedTestPeriodId,
      effectivePeriodId,
      queryEnabled,
      dashboardData: !!dashboardData,
      testPeriodsLoading,
      isFetching,
      shouldShowLoading,
      rqData: !!rqData,
      queryError: queryError?.message,
      testPeriods: testPeriods.length,
      testPeriodsArray: testPeriods, // 実際の配列も含める
    };
  }, [authLoading, userProfile, selectedTestPeriodId, effectivePeriodId, queryEnabled, dashboardData, testPeriodsLoading, isFetching, shouldShowLoading, rqData, queryError, testPeriods]);
  
  // ローディング状態をログに出力
  useEffect(() => {
    console.log('[DashboardLayout] Loading state:', {
      shouldShowLoading,
      authLoading,
      isStudent: userProfile?.role === 'student',
      hasData: !!dashboardData,
      testPeriodsLoading,
      queryEnabled,
      isFetching,
    });
  }, [shouldShowLoading, authLoading, userProfile?.role, dashboardData, testPeriodsLoading, queryEnabled, isFetching]);

  if (shouldShowLoading) {
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
          <DebugPanel enabled={true} />
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
          isLoading: isFetching,
          onTaskUpdate: () => refetch(),
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
          
          <MobileNavigation />
        </DashboardProvider>
        
        {/* デバッグパネル（本番環境でも表示） */}
        <DebugPanel enabled={true} />
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