'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createTestPeriod, getTestPeriodsByTeacherId, getTestPeriodsByClassId, softDeleteTestPeriod } from '@/lib/supabase/test-periods';
import { fetchSchoolsWithGrades, createSchool, createGrade, searchSchools, createDebouncedSearch, SchoolSearchResult } from '@/lib/supabase/schools';
import type { TestPeriod, School, Grade } from '@/types';
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
  
  // 学校・学年選択用の状態
  const [schools, setSchools] = useState<(School & { grades: Grade[] })[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [availableGrades, setAvailableGrades] = useState<Grade[]>([]);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolPrefecture, setNewSchoolPrefecture] = useState('');
  const [newSchoolCity, setNewSchoolCity] = useState('');
  const [showNewSchoolForm, setShowNewSchoolForm] = useState(false);
  const [creatingSchool, setCreatingSchool] = useState(false);
  
  // 学校検索用の状態
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SchoolSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // デバウンス付き検索
  const debouncedSearch = createDebouncedSearch(300);
  
  // 学校検索ハンドラー
  const handleSearchChange = (query: string) => {
    console.log('[handleSearchChange] Called with query:', query);
    setSearchQuery(query);
    if (query.length >= 2) {
      console.log('[handleSearchChange] Starting search for:', query);
      setIsSearching(true);
      debouncedSearch(query, (results) => {
        console.log('[handleSearchChange] Search results:', results);
        setSearchResults(results);
        setIsSearching(false);
        setShowSearchResults(true);
      });
    } else {
      console.log('[handleSearchChange] Query too short, clearing results');
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };
  
  // 検索結果から学校を選択
  const handleSchoolSelect = async (school: SchoolSearchResult) => {
    setSearchQuery(school.name);
    setShowSearchResults(false);
    
    // 既存の学校リストに追加
    try {
      const schoolId = await createSchool(school.name, school.prefecture, school.city);
      setSelectedSchoolId(schoolId);
      
      // 学校リストを再読み込み
      const updatedSchools = await fetchSchoolsWithGrades();
      setSchools(updatedSchools);
      
      // デフォルト学年を作成
      const gradeId = await createGrade(schoolId, 1, '1年生');
      setSelectedGradeId(gradeId);
      
      // 利用可能な学年を更新
      const grades = updatedSchools.find(s => s.id === schoolId)?.grades || [];
      setAvailableGrades(grades);
    } catch (error) {
      console.error('学校作成エラー:', error);
      setError('学校の作成に失敗しました');
    }
  };
  
  // managed 作成用フォーム
  const [semester, setSemester] = useState<'first' | 'second' | 'third'>('first');
  const [testType, setTestType] = useState<'midterm' | 'final' | 'other'>('midterm');
  const [customTestName, setCustomTestName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newClassId, setNewClassId] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // 科目選択用のデータ（生徒と同じ）
  const availableSubjects = [
    { id: '国語', name: '国語' },
    { id: '数学', name: '数学' },
    { id: '英語', name: '英語' },
    { id: '理科', name: '理科' },
    { id: '社会', name: '社会' },
    { id: '音楽', name: '音楽' },
    { id: '美術', name: '美術' },
    { id: '保健体育', name: '保健体育' },
    { id: '技術家庭', name: '技術・家庭' },
  ];

  // 学校・学年データの読み込み
  useEffect(() => {
    const loadSchoolsAndGrades = async () => {
      try {
        const data = await fetchSchoolsWithGrades();
        setSchools(data);
        
        // デフォルトで「個人クラス」を選択
        const personalClass = data.find(s => s.name === '個人クラス');
        if (personalClass) {
          setSelectedSchoolId(personalClass.id);
          setAvailableGrades(personalClass.grades);
          if (personalClass.grades.length > 0) {
            setSelectedGradeId(personalClass.grades[0].id);
          }
        }
      } catch (error) {
        console.error('学校・学年データの読み込みに失敗:', error);
        setTeacherError('学校・学年データの読み込みに失敗しました');
      }
    };

    if (userProfile?.role === 'teacher') {
      loadSchoolsAndGrades();
    }
  }, [userProfile]);

  // 学校選択時の学年更新
  useEffect(() => {
    if (selectedSchoolId) {
      const selectedSchool = schools.find(s => s.id === selectedSchoolId);
      if (selectedSchool) {
        setAvailableGrades(selectedSchool.grades);
        setSelectedGradeId(''); // 学年選択をリセット
      }
    }
  }, [selectedSchoolId, schools]);

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

  // 科目選択のヘルパー関数
  const toggleSubject = (subjectId: string) => {
    setSelectedSubjects(prev => {
      if (prev.includes(subjectId)) {
        return prev.filter(id => id !== subjectId);
      } else {
        return [...prev, subjectId];
      }
    });
  };

  const selectAllSubjects = () => {
    setSelectedSubjects(availableSubjects.map(subject => subject.id));
  };

  const clearAllSubjects = () => {
    setSelectedSubjects([]);
  };

  // 新規学校作成
  const handleCreateSchool = async () => {
    if (!newSchoolName.trim()) {
      setTeacherError('学校名を入力してください');
      return;
    }

    setCreatingSchool(true);
    setTeacherError('');

    try {
      const schoolId = await createSchool(newSchoolName.trim(), newSchoolPrefecture.trim() || undefined, newSchoolCity.trim() || undefined);
      
      // 1-3年生の学年を自動作成
      const gradePromises = [1, 2, 3].map(gradeNumber => 
        createGrade(schoolId, gradeNumber, `${gradeNumber}年生`)
      );
      await Promise.all(gradePromises);

      // 学校一覧を再読み込み
      const updatedSchools = await fetchSchoolsWithGrades();
      setSchools(updatedSchools);

      // 新しく作成した学校を選択
      setSelectedSchoolId(schoolId);
      const newSchool = updatedSchools.find(s => s.id === schoolId);
      if (newSchool) {
        setAvailableGrades(newSchool.grades);
        if (newSchool.grades.length > 0) {
          setSelectedGradeId(newSchool.grades[0].id);
        }
      }

      // フォームをリセット
      setNewSchoolName('');
      setNewSchoolPrefecture('');
      setNewSchoolCity('');
      setShowNewSchoolForm(false);

    } catch (error) {
      setTeacherError(error instanceof Error ? error.message : '学校の作成に失敗しました');
    } finally {
      setCreatingSchool(false);
    }
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
          <CardContent className="space-y-4">
            {/* 学校・学年選択 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">対象学校・学年を選択してください</div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">学校</label>
                  <div className="flex gap-2">
                    <select 
                      className="border rounded px-3 py-2 flex-1" 
                      value={selectedSchoolId} 
                      onChange={e => setSelectedSchoolId(e.target.value)}
                    >
                      <option value="">学校を選択</option>
                      {schools.map(school => (
                        <option key={school.id} value={school.id}>
                          {school.name}
                        </option>
                      ))}
                    </select>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowNewSchoolForm(!showNewSchoolForm)}
                    >
                      新規作成
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">学年</label>
                  <select 
                    className="border rounded px-3 py-2 w-full" 
                    value={selectedGradeId} 
                    onChange={e => setSelectedGradeId(e.target.value)}
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
              </div>

              {/* 新規学校作成フォーム */}
              {showNewSchoolForm && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="font-medium text-gray-900">新規学校作成</h3>
                  
                  {/* 学校検索機能 */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      学校名を検索（推奨）
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full border rounded px-3 py-2 pr-8"
                        placeholder="学校名を入力してください（2文字以上）"
                        value={searchQuery}
                        onChange={e => handleSearchChange(e.target.value)}
                      />
                      {isSearching && (
                        <div className="absolute right-2 top-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        </div>
                      )}
                    </div>
                    
                    {/* 検索結果表示 */}
                    {showSearchResults && searchResults.length > 0 && (
                      <div className="border rounded bg-white max-h-48 overflow-y-auto">
                        {searchResults.map((school, index) => (
                          <div
                            key={index}
                            className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                            onClick={() => handleSchoolSelect(school)}
                          >
                            <div className="font-medium">{school.name}</div>
                            <div className="text-sm text-gray-600">
                              {school.prefecture} {school.city}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {showSearchResults && searchResults.length === 0 && !isSearching && (
                      <div className="text-sm text-gray-500 p-2">
                        該当する学校が見つかりませんでした。<br />
                        手動で学校名を入力してください。
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center text-gray-500 text-sm">または</div>
                  
                  {/* 手動入力フォーム */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      className="border rounded px-3 py-2"
                      placeholder="学校名（必須）"
                      value={newSchoolName}
                      onChange={e => setNewSchoolName(e.target.value)}
                    />
                    <input
                      type="text"
                      className="border rounded px-3 py-2"
                      placeholder="都道府県（任意）"
                      value={newSchoolPrefecture}
                      onChange={e => setNewSchoolPrefecture(e.target.value)}
                    />
                    <input
                      type="text"
                      className="border rounded px-3 py-2"
                      placeholder="市区町村（任意）"
                      value={newSchoolCity}
                      onChange={e => setNewSchoolCity(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      loading={creatingSchool}
                      onClick={handleCreateSchool}
                    >
                      学校を作成
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setShowNewSchoolForm(false);
                        setSearchQuery('');
                        setSearchResults([]);
                        setShowSearchResults(false);
                      }}
                    >
                      キャンセル
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <option value="">クラスを選択（任意）</option>
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
            
            {/* 科目選択（ボタン形式） */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">試験科目を選択してください</div>
              
              {/* クイックアクション */}
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllSubjects}
                >
                  全て選択
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAllSubjects}
                >
                  選択をクリア
                </Button>
              </div>

              {/* 科目選択グリッド */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableSubjects.map((subject) => {
                  const isSelected = selectedSubjects.includes(subject.id);
    return (
                    <div
                      key={subject.id}
                      onClick={() => toggleSubject(subject.id)}
                      className={`
                        relative cursor-pointer rounded-lg border-2 p-3 hover:bg-gray-50 transition-all
                        ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                            : 'border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSubject(subject.id)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                          />
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {subject.name}
                          </div>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 選択済み科目のサマリー */}
              {selectedSubjects.length > 0 && (
                <div className="bg-green-50 rounded-lg p-3">
                  <h3 className="font-medium text-green-900 mb-2">選択済み科目</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedSubjects.map((subjectId) => {
                      const subject = availableSubjects.find(s => s.id === subjectId);
                      return (
                        <span
                          key={subjectId}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                        >
                          {subject?.name}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-sm text-green-700 mt-2">
                    {selectedSubjects.length}科目を選択中
                  </p>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-600">タイトル: {
              testType === 'other' && customTestName
                ? customTestName
                : `${semester === 'first' ? '1学期' : semester === 'second' ? '2学期' : '3学期'} ${testType === 'midterm' ? '中間試験' : testType === 'final' ? '期末試験' : 'その他'}`
            }</div>
            <div className="flex justify-end">
              <Button loading={creating} onClick={async ()=>{
                if (!currentUser) return;
                if (!newStart || !newEnd || !selectedSchoolId || !selectedGradeId) { 
                  setTeacherError('期間/学校/学年を入力してください'); 
                  return; 
                }
                if (selectedSubjects.length === 0) { setTeacherError('科目を選択してください'); return; }
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
                    classId: newClassId || undefined, // 任意
                    gradeId: selectedGradeId, // 新システム
                    subjects: selectedSubjects,
                    createdBy: currentUser.id,
                  });
                  // クリア＆再読込
                  setSemester('first'); setTestType('midterm'); setCustomTestName('');
                  setNewStart(''); setNewEnd(''); setNewClassId(''); setSelectedSubjects([]);
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