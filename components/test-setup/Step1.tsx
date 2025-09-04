'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';

interface Step1Props {
  onNext: (data: Step1Data) => void;
  initialData?: Step1Data;
}

export interface Step1Data {
  semester: 'first' | 'second' | 'third'; // 学期制
  testType: 'midterm' | 'final' | 'other'; // テスト種別
  customTestName?: string; // カスタムテスト名
  startDate: string;
  endDate: string;
}

export default function Step1({ onNext, initialData }: Step1Props) {
  const [formData, setFormData] = useState<Step1Data>(
    initialData || {
      semester: 'first',
      testType: 'midterm',
      customTestName: '',
      startDate: '',
      endDate: '',
    }
  );
  const [errors, setErrors] = useState<Partial<Step1Data>>({});

  const semesterOptions = [
    { value: 'first', label: '1学期' },
    { value: 'second', label: '2学期' },
    { value: 'third', label: '3学期' },
  ];

  const testTypeOptions = [
    { value: 'midterm', label: '中間試験' },
    { value: 'final', label: '期末試験' },
    { value: 'other', label: 'その他' },
  ];

  const validateForm = (): boolean => {
    const newErrors: Partial<Step1Data> = {};

    if (!formData.startDate) {
      newErrors.startDate = '開始日は必須です';
    }

    if (!formData.endDate) {
      newErrors.endDate = '終了日は必須です';
    }

    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      if (startDate >= endDate) {
        newErrors.endDate = '終了日は開始日より後の日付を選択してください';
      }
      if (startDate < new Date()) {
        newErrors.startDate = '開始日は今日以降の日付を選択してください';
      }
    }

    if (formData.testType === 'other' && !formData.customTestName?.trim()) {
      newErrors.customTestName = 'テスト名を入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onNext(formData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // エラーがある場合はクリア
    if (errors[name as keyof Step1Data]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const getTestTitle = () => {
    if (formData.testType === 'other' && formData.customTestName) {
      return formData.customTestName;
    }
    
    const semester = semesterOptions.find(s => s.value === formData.semester)?.label || '';
    const testType = testTypeOptions.find(t => t.value === formData.testType)?.label || '';
    
    return `${semester} ${testType}`;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>テスト期間の基本設定</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 学期選択 */}
            <Select
              name="semester"
              label="学期"
              value={formData.semester}
              onChange={handleChange}
              options={semesterOptions}
              fullWidth
            />

            {/* テスト種別選択 */}
            <Select
              name="testType"
              label="テスト種別"
              value={formData.testType}
              onChange={handleChange}
              options={testTypeOptions}
              fullWidth
            />

            {/* カスタムテスト名（その他を選択した場合） */}
            {formData.testType === 'other' && (
              <Input
                name="customTestName"
                label="テスト名"
                value={formData.customTestName}
                onChange={handleChange}
                error={errors.customTestName}
                fullWidth
                placeholder="例: 実力テスト、模試など"
              />
            )}

            {/* 日程設定 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="date"
                name="startDate"
                label="テスト開始日"
                value={formData.startDate}
                onChange={handleChange}
                error={errors.startDate}
                fullWidth
              />
              <Input
                type="date"
                name="endDate"
                label="テスト終了日"
                value={formData.endDate}
                onChange={handleChange}
                error={errors.endDate}
                fullWidth
              />
            </div>

            {/* プレビュー */}
            {formData.startDate && formData.endDate && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">テスト期間プレビュー</h3>
                <div className="space-y-1 text-sm text-blue-800">
                  <div><strong>テスト名:</strong> {getTestTitle()}</div>
                  <div><strong>期間:</strong> {new Date(formData.startDate).toLocaleDateString('ja-JP')} 〜 {new Date(formData.endDate).toLocaleDateString('ja-JP')}</div>
                  <div><strong>日数:</strong> {Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1}日間</div>
                </div>
              </div>
            )}

            {/* 注意事項 */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">注意事項</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>テスト期間は後から変更できません</li>
                      <li>開始日は今日以降の日付を選択してください</li>
                      <li>余裕を持った学習計画を立てるため、実際のテスト日の1-2週間前から設定することをお勧めします</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => window.location.href = '/dashboard'}
                size="lg"
              >
                キャンセル
              </Button>
              <Button type="submit" size="lg">
                次へ進む
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}