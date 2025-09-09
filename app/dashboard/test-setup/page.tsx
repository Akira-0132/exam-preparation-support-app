'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createTestPeriod, getTestPeriodsByTeacherId, getTestPeriodsByClassId, softDeleteTestPeriod } from '@/lib/supabase/test-periods';
import type { TestPeriod } from '@/types';
import { StudentProfile } from '@/types';
import StepIndicator from '@/components/test-setup/StepIndicator';
import Step1, { Step1Data } from '@/components/test-setup/Step1';
import Step2, { Step2Data } from '@/components/test-setup/Step2';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';

type SetupData = {
  step1?: Step1Data;
  step2?: Step2Data;
};

export default function TestSetupPage() {
  const router = useRouter();
  const { userProfile, currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [setupData, setSetupData] = useState<SetupData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  // Teacher view states
  const [teacherLoading, setTeacherLoading] = useState(true);
  const [teacherError, setTeacherError] = useState<string>('');
  const [teacherPeriods, setTeacherPeriods] = useState<TestPeriod[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<{ id: string; name: string }[]>([]);
  const [creating, setCreating] = useState(false);
  // managed 作成用フォーム
  const [semester, setSemester] = useState<'first' | 'second' | 'third'>('first');
  const [testType, setTestType] = useState<'midterm' | 'final' | 'other'>('midterm');
  const [customTestName, setCustomTestName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newClassId, setNewClassId] = useState('');
  const [newSubjects, setNewSubjects] = useState('');

  // Load teacher periods when role is teacher
  useEffect(() => {
    const run = async () => {
      if (!currentUser || userProfile?.role !== 'teacher') return;
      setTeacherLoading(true);
      setTeacherError('');
      try {
        // 担当クラス取得（自分が担任 or managedClassIds に含まれるクラス）
        if (!supabase) throw new Error('Supabase is not initialized');
        const up: any = userProfile as any;
        const managedIds: string[] = Array.isArray(up?.managedClassIds) ? up.managedClassIds : [];
        const results: any[] = [];
        const { data: ownRows, error: ownErr } = await supabase
          .from('classes')
          .select('id, name')
          .eq('teacher_id', currentUser.id);
        if (ownErr) throw ownErr;
        if (ownRows) results.push(...ownRows);
        if (managedIds.length > 0) {
          const { data: managedRows, error: mErr } = await supabase
            .from('classes')
            .select('id, name')
            .in('id', managedIds);
          if (mErr) throw mErr;
          if (managedRows) results.push(...managedRows);
        }
        const seen = new Set<string>();
        const cls = results.filter((c: any) => {
          if (seen.has(c.id)) return false; seen.add(c.id); return true;
        }).map((c: any) => ({ id: c.id, name: c.name }));
        setTeacherClasses(cls);

        const classIds: string[] = [];
        const up2: any = userProfile as any;
        if (up2.classId) classIds.push(up2.classId);
        if (Array.isArray(up2.managedClassIds)) classIds.push(...up2.managedClassIds);

        let aggregated: TestPeriod[] = [];
        if (classIds.length > 0) {
          const lists = await Promise.all(classIds.map((cid: string) => getTestPeriodsByClassId(cid)));
          const map = new Map<string, TestPeriod>();
          lists.flat().forEach(p => map.set(p.id, p));
          aggregated = Array.from(map.values());
        }

        if (aggregated.length === 0) {
          aggregated = await getTestPeriodsByTeacherId(currentUser.id);
        }

        setTeacherPeriods(aggregated);
      } catch (e) {
        setTeacherError(e instanceof Error ? e.message : String(e));
      } finally {
        setTeacherLoading(false);
      }
    };
    run();
  }, [currentUser, userProfile]);

  const handleSoftDelete = async (id: string) => {
    if (!currentUser) return;
    try {
      await softDeleteTestPeriod(id, currentUser.id);
      setTeacherPeriods(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      setTeacherError(e instanceof Error ? e.message : String(e));
    }
  };

  const stepTitles = [
    'テスト期間設定',
    '科目選択',
  ];

  const handleStep1Next = (data: Step1Data) => {
    setSetupData(prev => ({ ...prev, step1: data }));
    setCurrentStep(2);
  };

  const handleStep2Next = async (data: Step2Data) => {
    setSetupData(prev => ({ ...prev, step2: data }));
    
    if (!userProfile || !currentUser || userProfile.role !== 'student' || !setupData.step1) {
      setError('設定データが不完全です。最初からやり直してください。');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const studentProfile = userProfile as StudentProfile;
      const { step1 } = setupData;

      // 学生のclass_idを検証・修正
      let classId = studentProfile.classId;
      
      // UUID形式でないclass_idや空の場合は個人クラスを作成
      const isValidUuid = (id: string | undefined): boolean => {
        if (!id) return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
      };
      
      if (!isValidUuid(classId)) {
        console.log('[TestSetup] Invalid or missing class_id:', classId, 'Creating personal class...');
        
        // 個人クラスを作成
        if (!supabase) {
          throw new Error('Supabase client is not initialized');
        }
        
        const { data: newClass, error: classError } = await supabase
          .from('classes')
          .insert({
            name: `${studentProfile.displayName || 'ユーザー'}の個人クラス`,
            grade: 1,
            teacher_id: currentUser.id,
            student_ids: [currentUser.id],
          })
          .select('id')
          .single();

        if (classError) {
          console.error('[TestSetup] Failed to create personal class:', classError);
          throw new Error('個人クラスの作成に失敗しました');
        }

        classId = newClass.id;
        console.log('[TestSetup] Created personal class with ID:', classId);

        // ユーザープロフィールを更新
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ class_id: classId })
          .eq('id', currentUser.id);

        if (updateError) {
          console.error('[TestSetup] Failed to update user profile with class_id:', updateError);
        } else {
          console.log('[TestSetup] Updated user profile with new class_id');
        }
      } else {
        console.log('[TestSetup] Using existing class_id:', classId);
      }

      // テスト名を生成
      const getTestTitle = () => {
        if (step1.testType === 'other' && step1.customTestName) {
          return step1.customTestName;
        }
        
        const semesterNames = { first: '1学期', second: '2学期', third: '3学期' };
        const testTypeNames = { midterm: '中間試験', final: '期末試験', other: 'その他' };
        
        return `${semesterNames[step1.semester]} ${testTypeNames[step1.testType]}`;
      };

      // テスト期間を作成
      console.log('[TestSetup] Creating test period with classId:', classId);
      const testPeriodId = await createTestPeriod({
        title: getTestTitle(),
        startDate: new Date(step1.startDate).toISOString(),
        endDate: new Date(step1.endDate).toISOString(),
        classId: classId, // 正しいUUID形式のclassIdを使用
        subjects: data.selectedSubjects,
        createdBy: currentUser.id,
      });

      // ダッシュボードにリダイレクト
      router.push('/dashboard?setup=complete');

    } catch (err) {
      console.error('テスト設定の保存に失敗しました:', err);
      setError('設定の保存に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  // デフォルトタスク生成は廃止（ユーザーが明示的に追加・分割設定を行う）

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStartOver = () => {
    setCurrentStep(1);
    setSetupData({});
    setError('');
  };

  // Teacher (admin) view: list periods and allow soft delete
  if (userProfile && userProfile.role === 'teacher') {
    return (
      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">先生用: テスト期間管理</h1>
          <Button onClick={() => router.push('/dashboard')}>ダッシュボードへ</Button>
        </div>

        {/* 新規作成（managed/public） */}
        <Card>
          <CardHeader>
            <CardTitle>新規テスト期間（公開・先生管理）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* タイトルは学期×試験種から生成 */}
              <div className="grid grid-cols-2 gap-2">
                <select className="border rounded px-3 py-2" value={semester} onChange={e=>setSemester(e.target.value as any)}>
                  <option value="first">1学期</option>
                  <option value="second">2学期</option>
                  <option value="third">3学期</option>
                </select>
                <select className="border rounded px-3 py-2" value={testType} onChange={e=>setTestType(e.target.value as any)}>
                  <option value="midterm">中間試験</option>
                  <option value="final">期末試験</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <select className="border rounded px-3 py-2" value={newClassId} onChange={e=>setNewClassId(e.target.value)}>
                <option value="">クラスを選択</option>
                {teacherClasses.map(c=> (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input type="date" className="border rounded px-3 py-2" value={newStart} onChange={e=>setNewStart(e.target.value)} />
              <input type="date" className="border rounded px-3 py-2" value={newEnd} onChange={e=>setNewEnd(e.target.value)} />
            </div>
            {testType === 'other' && (
              <input className="border rounded px-3 py-2 w-full" placeholder="カスタム試験名（例: 実力テスト）" value={customTestName} onChange={e=>setCustomTestName(e.target.value)} />
            )}
            <input className="border rounded px-3 py-2 w-full" placeholder="科目（カンマ区切り 例: 数学,英語）" value={newSubjects} onChange={e=>setNewSubjects(e.target.value)} />
            <div className="text-sm text-gray-600">タイトル: {
              testType === 'other' && customTestName
                ? customTestName
                : `${semester === 'first' ? '1学期' : semester === 'second' ? '2学期' : '3学期'} ${testType === 'midterm' ? '中間試験' : testType === 'final' ? '期末試験' : 'その他'}`
            }</div>
            <div className="flex justify-end">
              <Button loading={creating} onClick={async ()=>{
                if (!currentUser) return;
                if (!newStart || !newEnd || !newClassId) { setTeacherError('期間/クラスを入力してください'); return; }
                setCreating(true);
                setTeacherError('');
                try {
                  const title = (testType === 'other' && customTestName)
                    ? customTestName
                    : `${semester === 'first' ? '1学期' : semester === 'second' ? '2学期' : '3学期'} ${testType === 'midterm' ? '中間試験' : testType === 'final' ? '期末試験' : 'その他'}`;
                  const id = await createTestPeriod({
                    title,
                    startDate: new Date(newStart).toISOString(),
                    endDate: new Date(newEnd).toISOString(),
                    classId: newClassId,
                    subjects: newSubjects.split(',').map(s=>s.trim()).filter(Boolean),
                    createdBy: currentUser.id,
                  });
                  // クリア＆再読込
                  setSemester('first'); setTestType('midterm'); setCustomTestName('');
                  setNewStart(''); setNewEnd(''); setNewClassId(''); setNewSubjects('');
                  setTeacherPeriods(prev=>[{ id, title: '', startDate: '', endDate: '', classId: newClassId, subjects: [], createdBy: currentUser.id, createdAt: '', updatedAt: '', mode: 'managed', visibility: 'public' }, ...prev]);
                  // 正しく反映したいので一覧再取得
                  if (typeof window !== 'undefined') window.location.reload();
                } catch (e:any) {
                  setTeacherError(e?.message || String(e));
                } finally {
                  setCreating(false);
                }
              }}>作成する</Button>
            </div>
            {teacherError && <p className="text-red-600 text-sm">{teacherError}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>自分が作成したテスト期間</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teacherLoading ? (
              <p>読み込み中...</p>
            ) : teacherError ? (
              <p className="text-red-600">{teacherError}</p>
            ) : teacherPeriods.length === 0 ? (
              <div className="text-center text-gray-600">
                まだ期間がありません。<Button className="ml-2" size="sm" onClick={() => router.push('/dashboard/test-setup')}>新規作成</Button>
              </div>
            ) : (
              <div className="divide-y">
                {teacherPeriods
                  .filter(p => (p.mode || 'managed') === 'managed')
                  .map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.title}</div>
                      <div className="text-sm text-gray-600">{p.startDate} ~ {p.endDate} {p.visibility === 'private' ? '(非公開)' : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/subjects?period=${p.id}`)}>開く</Button>
                      <Button size="sm" variant="danger" onClick={() => handleSoftDelete(p.id)}>削除（ソフト）</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>削除済みの管理</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" onClick={() => router.push('/dashboard/test-setup/deleted')}>削除済みを管理</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* ナビゲーションバー */}
      <div className="flex justify-between items-center mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard')}
          className="flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          ダッシュボードに戻る
        </Button>
        {currentStep > 1 && (
          <Button
            variant="outline"
            onClick={handleBack}
            size="sm"
          >
            前のステップに戻る
          </Button>
        )}
      </div>
      
      {/* ヘッダー */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">テスト期間設定</h1>
        <p className="text-gray-600">効果的な学習計画を立てるために、テスト期間の詳細を設定しましょう。</p>
      </div>

      {/* ステップインジケーター */}
      <StepIndicator
        currentStep={currentStep}
        totalSteps={stepTitles.length}
        stepTitles={stepTitles}
      />

      {/* エラーメッセージ */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartOver}
                className="mt-2 text-red-600 hover:text-red-800"
              >
                最初からやり直す
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 読み込み中オーバーレイ */}
      {loading && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-4"></div>
              <div>
                <h3 className="font-medium text-gray-900">設定を保存中...</h3>
                <p className="text-sm text-gray-600 mt-1">
                  テスト期間とタスクを作成しています
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ステップコンテンツ */}
      <div className="min-h-[600px]">
        {currentStep === 1 && (
          <Step1
            onNext={handleStep1Next}
            initialData={setupData.step1}
          />
        )}

        {currentStep === 2 && (
          <Step2
            onNext={handleStep2Next}
            onBack={handleBack}
            initialData={setupData.step2}
          />
        )}

      </div>

      {/* フッター情報 */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>設定は後からダッシュボードで変更することができます</p>
      </div>
    </div>
  );
}