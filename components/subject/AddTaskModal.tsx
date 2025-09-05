'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useDashboard } from '@/lib/context/DashboardContext';
import { createTask, createSplitTask } from '@/lib/supabase/tasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  subject: string;
}

export default function AddTaskModal({
  isOpen,
  onClose,
  onSuccess,
  subject
}: AddTaskModalProps) {
  const { currentUser } = useAuth();
  const { currentTestPeriod } = useDashboard();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    // 分割設定
    isSplitTask: false,
    totalUnits: 0,
    unitType: 'pages' as 'pages' | 'problems' | 'hours' | 'sections',
    dailyUnits: 0,
    weeklyCycles: 1, // テスト期間までに何週したいか
    useAutoCalculation: true, // 自動計算を使用するか
    // 範囲（ページ/問題の時のみ）
    rangeStart: undefined as number | undefined,
    rangeEnd: undefined as number | undefined,
  });
  
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});


  const unitTypeOptionsAll = [
    { value: 'pages', label: 'ページ' },
    { value: 'problems', label: '問題' },
    { value: 'hours', label: '分' },
    { value: 'sections', label: 'セクション' },
  ];
  const unitTypeOptionsSplit = [
    { value: 'pages', label: 'ページ' },
    { value: 'problems', label: '問題' },
  ];

  const weeklyCyclesOptions = [
    { value: '1', label: '1周（1回だけ）' },
    { value: '2', label: '2周（2回繰り返し）' },
    { value: '3', label: '3周（3回繰り返し）' },
    { value: '4', label: '4周（4回繰り返し）' },
  ];

  // 自動計算で1日あたりの量を算出
  const calculateDailyUnits = (totalUnits: number, weeklyCycles: number) => {
    if (!totalUnits || !currentTestPeriod?.startDate) return 0;
    
    const today = new Date();
    const testStartDate = new Date(currentTestPeriod.startDate);
    const diffTime = testStartDate.getTime() - today.getTime();
    const daysUntilTest = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (daysUntilTest <= 0) return totalUnits; // テスト開始日が過ぎている場合
    
    // 週数分の量を考慮して計算
    const totalWork = totalUnits * weeklyCycles;
    return Math.ceil(totalWork / daysUntilTest);
  };

  const getUnitLabel = (u: 'pages' | 'problems' | 'hours' | 'sections') =>
    u === 'pages' ? 'ページ' : u === 'problems' ? '問題' : u === 'hours' ? '分' : 'セクション';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const newFormData = {
      ...formData,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked
        : ['totalUnits', 'dailyUnits', 'weeklyCycles', 'rangeStart', 'rangeEnd'].includes(name) 
          ? parseInt(value) || 0 
          : value
    };
    // ページ/問題かつ範囲が入っている場合は総量を自動算出
    const isPageOrProblem = (newFormData.unitType === 'pages' || newFormData.unitType === 'problems');
    if (formData.isSplitTask && isPageOrProblem && newFormData.rangeStart && newFormData.rangeEnd && newFormData.rangeEnd >= newFormData.rangeStart) {
      newFormData.totalUnits = newFormData.rangeEnd - newFormData.rangeStart + 1;
    }

    // 自動計算が有効で、totalUnitsまたはweeklyCyclesが変更された場合
    if (newFormData.useAutoCalculation && 
        (name === 'totalUnits' || name === 'weeklyCycles' || name === 'rangeStart' || name === 'rangeEnd' || name === 'unitType') && 
        newFormData.totalUnits > 0) {
      newFormData.dailyUnits = calculateDailyUnits(newFormData.totalUnits, newFormData.weeklyCycles);
    }
    
    setFormData(newFormData);
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'タスク名を入力してください';
    }
    
    // 分割タスクのバリデーション
    if (formData.isSplitTask) {
      const isPageOrProblem = (formData.unitType === 'pages' || formData.unitType === 'problems');
      if (isPageOrProblem) {
        if (formData.rangeStart === undefined || formData.rangeEnd === undefined) {
          newErrors.rangeStart = '開始と終了を入力してください';
        } else if (formData.rangeEnd < formData.rangeStart) {
          newErrors.rangeStart = '範囲が不正です（開始 < 終了）';
        }
      }
      if (!formData.totalUnits || formData.totalUnits <= 0) {
        newErrors.totalUnits = '総量を入力してください';
      }
      if (!formData.dailyUnits || formData.dailyUnits <= 0) {
        newErrors.dailyUnits = '1日あたりの量を入力してください';
      }
      if (formData.dailyUnits && formData.totalUnits && formData.dailyUnits > formData.totalUnits) {
        newErrors.dailyUnits = '1日あたりの量は総量以下にしてください';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !currentUser || !currentTestPeriod) {
      return;
    }
    
    setSaving(true);
    
    try {
      if (formData.isSplitTask && formData.totalUnits && formData.dailyUnits && formData.unitType) {
        // 分割タスクを作成
        await createSplitTask(
          {
            title: formData.title,
            description: formData.description,
            subject: subject,
            priority: 'medium', // デフォルトで中優先度
            status: 'not_started',
            dueDate: new Date(currentTestPeriod.startDate).toISOString(), // テスト開始日を期限に
            estimatedTime: 30, // デフォルトで30分
            testPeriodId: currentTestPeriod.id,
            assignedTo: currentUser.id,
            createdBy: currentUser.id,
            taskType: 'parent',
          },
          formData.totalUnits,
          formData.unitType,
          formData.dailyUnits,
          formData.rangeStart,
          formData.rangeEnd
        );
      } else {
        // 通常のタスクを作成
        await createTask({
          title: formData.title,
          description: formData.description,
          subject: subject,
          priority: 'medium', // デフォルトで中優先度
          status: 'not_started',
          dueDate: new Date(currentTestPeriod.startDate).toISOString(), // テスト開始日を期限に
          estimatedTime: 30, // デフォルトで30分
          testPeriodId: currentTestPeriod.id,
          assignedTo: currentUser.id,
          createdBy: currentUser.id,
          taskType: 'single',
        });
      }
      
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('タスクの作成に失敗しました:', error);
      setErrors({ submit: 'タスクの作成に失敗しました。もう一度お試しください。' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // 初期形に完全リセット（分割関連フィールドも含む）
    setFormData({
      title: '',
      description: '',
      isSplitTask: false,
      totalUnits: 0,
      unitType: 'pages',
      dailyUnits: 0,
      weeklyCycles: 1,
      useAutoCalculation: true,
      rangeStart: undefined,
      rangeEnd: undefined,
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>新しいタスクを追加</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="タスク名"
              name="title"
              value={formData.title}
              onChange={handleChange}
              error={errors.title}
              placeholder="例: 教科書 p.50-60 を読む"
              required
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                詳細説明（任意）
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="タスクの詳細な説明を入力..."
              />
            </div>
            
            <div>
              <Input
                type="text"
                label="科目"
                value={subject}
                disabled
                className="bg-gray-100"
              />
            </div>
            
            {/* 分割タスク設定 */}
            <div className="border-t pt-4">
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="isSplitTask"
                  name="isSplitTask"
                  checked={formData.isSplitTask}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isSplitTask" className="text-sm font-medium text-gray-700">
                  分割タスクにする（大きなタスクを日割りで管理）
                </label>
              </div>
              
              {formData.isSplitTask && (
                <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="単位"
                      name="unitType"
                      value={formData.unitType}
                      onChange={handleChange}
                      options={unitTypeOptionsSplit}
                    />
                    <Input
                      type="number"
                      label="総量（自動算出）"
                      name="totalUnits"
                      value={(formData.totalUnits ?? 0).toString()}
                      onChange={handleChange}
                      error={errors.totalUnits}
                      min="1"
                      placeholder="30"
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                  
                  {(formData.unitType === 'pages' || formData.unitType === 'problems') && (
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        type="number"
                        label={formData.unitType === 'pages' ? '開始ページ' : '開始問題番号'}
                        name="rangeStart"
                        value={(formData.rangeStart ?? '').toString()}
                        onChange={handleChange}
                        error={errors.rangeStart}
                        min="1"
                        placeholder="10"
                      />
                      <Input
                        type="number"
                        label={formData.unitType === 'pages' ? '終了ページ' : '終了問題番号'}
                        name="rangeEnd"
                        value={(formData.rangeEnd ?? '').toString()}
                        onChange={handleChange}
                        error={errors.rangeEnd}
                        min="1"
                        placeholder="22"
                      />
                    </div>
                  )}

                  <Select
                    label="テスト開始までに何周したいか"
                    name="weeklyCycles"
                    value={(formData.weeklyCycles ?? 1).toString()}
                    onChange={handleChange}
                    options={weeklyCyclesOptions}
                  />
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="useAutoCalculation"
                      name="useAutoCalculation"
                      checked={formData.useAutoCalculation}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="useAutoCalculation" className="text-sm font-medium text-gray-700">
                      自動計算を使用（残り日数から自動で1日あたりの量を算出）
                    </label>
                  </div>
                  
                  <Input
                    type="number"
                    label="1日あたりの量"
                    name="dailyUnits"
                    value={(formData.dailyUnits ?? 0).toString()}
                    onChange={handleChange}
                    error={errors.dailyUnits}
                    min="1"
                    placeholder="3"
                    disabled={formData.useAutoCalculation}
                    className={formData.useAutoCalculation ? "bg-gray-100" : ""}
                  />
                  
                  {formData.totalUnits > 0 && formData.dailyUnits > 0 && (
                    <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                      <p>📅 完了予定日: {Math.ceil(formData.totalUnits / formData.dailyUnits)}日後</p>
                      <p>📊 進捗: 1日あたり {formData.dailyUnits}{getUnitLabel(formData.unitType)} ずつ進めます</p>
                      {formData.weeklyCycles > 1 && (
                        <p>🔄 週数: {formData.weeklyCycles}周（合計 {formData.totalUnits * formData.weeklyCycles}{getUnitLabel(formData.unitType)}）</p>
                      )}
                      {formData.useAutoCalculation && currentTestPeriod?.startDate && (
                        <p>🤖 自動計算: テスト開始まであと {Math.ceil((new Date(currentTestPeriod.startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}日</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={saving}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                disabled={saving}
              >
                {saving ? '保存中...' : 'タスクを追加'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}