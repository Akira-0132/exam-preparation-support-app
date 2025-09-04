'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createTestPeriod } from '@/lib/supabase/test-periods';
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

  if (!userProfile || userProfile.role !== 'student') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card variant="elevated">
          <CardContent className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">アクセスできません</h2>
            <p className="text-gray-600 mb-4">この機能は生徒アカウントでのみ利用できます。</p>
            <Button onClick={() => router.push('/dashboard')}>
              ダッシュボードに戻る
            </Button>
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