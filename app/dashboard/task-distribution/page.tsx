'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useDashboard } from '@/lib/context/DashboardContext';
import { fetchSchoolsWithGrades } from '@/lib/supabase/schools';
import { distributeTaskToStudents, getStudentsByGrade } from '@/lib/supabase/tasks';
import { School, Grade } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

interface Student {
  id: string;
  displayName: string;
  studentNumber?: string;
}

export default function TaskDistributionPage() {
  const router = useRouter();
  const { currentUser, userProfile } = useAuth();
  const { currentTestPeriod } = useDashboard();
  
  const [schools, setSchools] = useState<(School & { grades: Grade[] })[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [availableGrades, setAvailableGrades] = useState<Grade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [result, setResult] = useState<{ successCount: number; errorCount: number; errors: string[] } | null>(null);

  // フォームデータ
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subjects: [] as string[],
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: '',
    estimatedTime: 30,
    isSplitTask: false,
    totalUnits: 0,
    unitType: 'pages' as 'pages' | 'problems' | 'hours' | 'sections',
    dailyUnits: 0,
    rangeStart: 0,
    rangeEnd: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // 学校・学年データの読み込み
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

  // 学校選択時の学年更新
  useEffect(() => {
    if (selectedSchoolId && schools.length > 0) {
      const selectedSchool = schools.find(s => s.id === selectedSchoolId);
      if (selectedSchool) {
        setAvailableGrades(selectedSchool.grades);
        setSelectedGradeId('');
        setStudents([]);
      }
    }
  }, [selectedSchoolId, schools]);

  // 学年選択時の生徒取得
  useEffect(() => {
    if (selectedGradeId) {
      const loadStudents = async () => {
        setLoading(true);
        try {
          const studentsData = await getStudentsByGrade(selectedGradeId);
          setStudents(studentsData);
        } catch (error) {
          console.error('生徒データの読み込みに失敗:', error);
        } finally {
          setLoading(false);
        }
      };

      loadStudents();
    }
  }, [selectedGradeId]);

  // フォームバリデーション
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'タスク名を入力してください';
    }

    if (!selectedSchoolId) {
      newErrors.school = '学校を選択してください';
    }

    if (!selectedGradeId) {
      newErrors.grade = '学年を選択してください';
    }

    if (formData.subjects.length === 0) {
      newErrors.subjects = '科目を選択してください';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = '期限を設定してください';
    }

    if (formData.isSplitTask) {
      if (!formData.totalUnits || formData.totalUnits <= 0) {
        newErrors.totalUnits = '総量を入力してください';
      }
      if (!formData.dailyUnits || formData.dailyUnits <= 0) {
        newErrors.dailyUnits = '1日あたりの量を入力してください';
      }
      if (formData.dailyUnits > formData.totalUnits) {
        newErrors.dailyUnits = '1日あたりの量は総量以下にしてください';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // タスク配布実行
  const handleDistribute = async () => {
    if (!validateForm() || !currentUser || !currentTestPeriod) {
      return;
    }

    setDistributing(true);
    setResult(null);

    try {
      let totalSuccessCount = 0;
      let totalErrorCount = 0;
      const allErrors: string[] = [];

      // 選択された各科目に対してタスクを配布
      for (const subject of formData.subjects) {
        try {
          const result = await distributeTaskToStudents({
            title: formData.title,
            description: formData.description,
            subject: subject,
            priority: formData.priority,
            dueDate: formData.dueDate,
            estimatedTime: formData.estimatedTime,
            testPeriodId: currentTestPeriod.id,
            createdBy: currentUser.id,
            gradeId: selectedGradeId,
            isSplitTask: formData.isSplitTask,
            totalUnits: formData.totalUnits,
            unitType: formData.unitType,
            dailyUnits: formData.dailyUnits,
            rangeStart: formData.rangeStart,
            rangeEnd: formData.rangeEnd,
          });

          totalSuccessCount += result.successCount;
          totalErrorCount += result.errorCount;
          allErrors.push(...result.errors.map(error => `${subject}: ${error}`));
        } catch (error) {
          totalErrorCount += students.length;
          allErrors.push(`${subject}: タスク配布に失敗しました`);
        }
      }

      setResult({
        successCount: totalSuccessCount,
        errorCount: totalErrorCount,
        errors: allErrors
      });
    } catch (error) {
      console.error('タスク配布に失敗:', error);
      setResult({
        successCount: 0,
        errorCount: students.length * formData.subjects.length,
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">タスク配布</h1>
          <p className="text-gray-600 mt-1">生徒にタスクを一括配布します</p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard')}
        >
          ダッシュボードに戻る
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 配布設定フォーム */}
        <Card>
          <CardHeader>
            <CardTitle>配布設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 学校・学年選択 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">学校</label>
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
                {errors.school && <p className="text-red-500 text-sm mt-1">{errors.school}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">学年</label>
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
                {errors.grade && <p className="text-red-500 text-sm mt-1">{errors.grade}</p>}
              </div>
            </div>

            {/* タスク基本情報 */}
            <Input
              name="title"
              label="タスク名"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              error={errors.title}
              fullWidth
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">説明</label>
              <textarea
                className="w-full border rounded px-3 py-2"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="タスクの詳細説明"
              />
            </div>

            {/* 科目選択（複数選択） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">科目（複数選択可）</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  '国語', '数学', '英語', '理科', '社会',
                  '音楽', '美術', '保健体育', '技術家庭'
                ].map(subject => (
                  <label key={subject} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.subjects.includes(subject)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({
                            ...prev,
                            subjects: [...prev.subjects, subject]
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            subjects: prev.subjects.filter(s => s !== subject)
                          }));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{subject}</span>
                  </label>
                ))}
              </div>
              {errors.subjects && <p className="text-red-500 text-sm mt-1">{errors.subjects}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                name="priority"
                label="優先度"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
                options={[
                  { value: 'low', label: '低' },
                  { value: 'medium', label: '中' },
                  { value: 'high', label: '高' },
                ]}
                fullWidth
              />

              <Input
                type="number"
                name="estimatedTime"
                label="見積もり時間（分）"
                value={formData.estimatedTime}
                onChange={(e) => setFormData(prev => ({ ...prev, estimatedTime: parseInt(e.target.value) || 0 }))}
                fullWidth
              />
            </div>

            <Input
              type="date"
              name="dueDate"
              label="期限"
              value={formData.dueDate}
              onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              error={errors.dueDate}
              fullWidth
            />

            {/* 分割タスク設定 */}
            <div className="border-t pt-4">
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="isSplitTask"
                  checked={formData.isSplitTask}
                  onChange={(e) => setFormData(prev => ({ ...prev, isSplitTask: e.target.checked }))}
                />
                <label htmlFor="isSplitTask" className="text-sm font-medium text-gray-700">
                  分割タスクとして作成
                </label>
              </div>

              {formData.isSplitTask && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      type="number"
                      name="totalUnits"
                      label="総量"
                      value={formData.totalUnits}
                      onChange={(e) => setFormData(prev => ({ ...prev, totalUnits: parseInt(e.target.value) || 0 }))}
                      error={errors.totalUnits}
                      fullWidth
                    />

                    <Select
                      name="unitType"
                      label="単位"
                      value={formData.unitType}
                      onChange={(e) => setFormData(prev => ({ ...prev, unitType: e.target.value as 'pages' | 'problems' | 'hours' | 'sections' }))}
                      options={[
                        { value: 'pages', label: 'ページ' },
                        { value: 'problems', label: '問題' },
                        { value: 'hours', label: '時間' },
                        { value: 'sections', label: 'セクション' },
                      ]}
                      fullWidth
                    />
                  </div>

                  <Input
                    type="number"
                    name="dailyUnits"
                    label="1日あたりの量"
                    value={formData.dailyUnits}
                    onChange={(e) => setFormData(prev => ({ ...prev, dailyUnits: parseInt(e.target.value) || 0 }))}
                    error={errors.dailyUnits}
                    fullWidth
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      type="number"
                      name="rangeStart"
                      label="開始範囲"
                      value={formData.rangeStart}
                      onChange={(e) => setFormData(prev => ({ ...prev, rangeStart: parseInt(e.target.value) || 0 }))}
                      fullWidth
                    />

                    <Input
                      type="number"
                      name="rangeEnd"
                      label="終了範囲"
                      value={formData.rangeEnd}
                      onChange={(e) => setFormData(prev => ({ ...prev, rangeEnd: parseInt(e.target.value) || 0 }))}
                      fullWidth
                    />
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={handleDistribute}
              disabled={distributing || students.length === 0 || formData.subjects.length === 0}
              className="w-full"
            >
              {distributing 
                ? '配布中...' 
                : `${students.length}名の生徒に${formData.subjects.length}科目分のタスクを配布`
              }
            </Button>
          </CardContent>
        </Card>

        {/* 配布対象生徒一覧 */}
        <Card>
          <CardHeader>
            <CardTitle>配布対象生徒</CardTitle>
            {formData.subjects.length > 0 && (
              <p className="text-sm text-gray-600">
                選択科目: {formData.subjects.join(', ')}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">生徒データを読み込み中...</p>
              </div>
            ) : students.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {students.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{student.displayName}</p>
                      {student.studentNumber && (
                        <p className="text-sm text-gray-500">学籍番号: {student.studentNumber}</p>
                      )}
                      {formData.subjects.length > 0 && (
                        <p className="text-xs text-blue-600">
                          {formData.subjects.length}科目のタスクを受信予定
                        </p>
                      )}
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">学校と学年を選択してください</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 配布結果 */}
      {result && (
        <Card>
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
                <div className="space-y-1">
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
                  setFormData({
                    title: '',
                    description: '',
                    subject: '国語',
                    priority: 'medium',
                    dueDate: '',
                    estimatedTime: 30,
                    isSplitTask: false,
                    totalUnits: 0,
                    unitType: 'pages',
                    dailyUnits: 0,
                    rangeStart: 0,
                    rangeEnd: 0,
                  });
                }}
                variant="outline"
              >
                新しいタスクを配布
              </Button>
              <Button onClick={() => router.push('/dashboard')}>
                ダッシュボードに戻る
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
