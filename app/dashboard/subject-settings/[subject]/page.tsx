'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useDashboard } from '@/lib/context/DashboardContext';
import { getTestPeriod, getTestPeriodsByTeacherId } from '@/lib/supabase/test-periods';
import { fetchSchoolsWithGrades } from '@/lib/supabase/schools';
import { createTask, createSplitTask, getTasksBySubject } from '@/lib/supabase/tasks';
import { TestPeriod, School, Grade, Task } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

interface SubjectSettings {
  subject: string;
  testPeriodId: string;
  gradeId: string;
  schoolId: string;
  isConfigured: boolean;
  taskTemplates: TaskTemplate[];
  distributionSettings: DistributionSettings;
}

interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  estimatedTime: number;
  isSplitTask: boolean;
  totalUnits?: number;
  unitType?: 'pages' | 'problems' | 'hours' | 'sections';
  dailyUnits?: number;
  rangeStart?: number;
  rangeEnd?: number;
}

interface DistributionSettings {
  autoDistribute: boolean;
  distributionDate: string;
  reminderDays: number;
  allowStudentModification: boolean;
}

export default function SubjectSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, userProfile } = useAuth();
  const { currentTestPeriod } = useDashboard();
  
  const [subject, setSubject] = useState('');
  const [testPeriod, setTestPeriod] = useState<TestPeriod | null>(null);
  const [schools, setSchools] = useState<(School & { grades: Grade[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SubjectSettings | null>(null);
  const [showTaskTemplateForm, setShowTaskTemplateForm] = useState(false);
  const [newTaskTemplate, setNewTaskTemplate] = useState<Partial<TaskTemplate>>({});
  const [actualTasks, setActualTasks] = useState<Task[]>([]);

  // URLパラメータから科目とテスト期間を取得
  useEffect(() => {
    const subjectParam = searchParams.get('subject');
    const periodParam = searchParams.get('period');
    
    if (subjectParam) {
      setSubject(decodeURIComponent(subjectParam));
    }
    
    if (periodParam) {
      getTestPeriod(periodParam).then(period => {
        if (period) {
          setTestPeriod(period);
        }
      });
    }
  }, [searchParams]);

  // 学校データの読み込み
  useEffect(() => {
    const loadSchools = async () => {
      try {
        const data = await fetchSchoolsWithGrades();
        setSchools(data);
      } catch (error) {
        console.error('学校データの読み込みに失敗:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userProfile?.role === 'teacher') {
      loadSchools();
    }
  }, [userProfile]);

  // 科目設定の初期化
  useEffect(() => {
    if (testPeriod && subject && currentUser) {
      // 実際のタスクデータを取得
      const loadActualTasks = async () => {
        try {
          console.log('[SubjectSettings] Loading tasks for:', {
            userId: currentUser.id,
            subject,
            testPeriodId: testPeriod.id,
            isTeacher: true
          });
          const tasks = await getTasksBySubject(currentUser.id, subject, testPeriod.id, true);
          console.log('[SubjectSettings] Retrieved tasks:', tasks);
          setActualTasks(tasks);
          
          // タスクテンプレートとして変換
          const taskTemplates: TaskTemplate[] = tasks.map(task => ({
            id: task.id,
            title: task.title,
            description: task.description || '',
            priority: task.priority,
            estimatedTime: task.estimatedTime || 30,
            isSplitTask: task.taskType === 'parent',
            totalUnits: task.totalUnits,
            unitType: task.unitType,
            dailyUnits: task.dailyUnits,
            rangeStart: task.rangeStart,
            rangeEnd: task.rangeEnd,
          }));
          
          setSettings({
            subject,
            testPeriodId: testPeriod.id,
            gradeId: testPeriod.classId || '',
            schoolId: '', // テスト期間から学校IDを取得する必要がある
            isConfigured: tasks.length > 0,
            taskTemplates,
            distributionSettings: {
              autoDistribute: false,
              distributionDate: '',
              reminderDays: 1,
              allowStudentModification: true,
            }
          });
        } catch (error) {
          console.error('タスクデータの取得に失敗:', error);
          setActualTasks([]);
          setSettings({
            subject,
            testPeriodId: testPeriod.id,
            gradeId: testPeriod.classId || '',
            schoolId: '',
            isConfigured: false,
            taskTemplates: [],
            distributionSettings: {
              autoDistribute: false,
              distributionDate: '',
              reminderDays: 1,
              allowStudentModification: true,
            }
          });
        }
      };
      
      loadActualTasks();
    }
  }, [testPeriod, subject, currentUser]);

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

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-500 mt-2">読み込み中...</p>
      </div>
    );
  }

  if (!testPeriod || !subject) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-700">データが見つかりません</h2>
        <p className="text-gray-500 mt-2">テスト期間または科目の情報が正しくありません。</p>
        <Button onClick={() => router.push('/dashboard/subjects')} className="mt-4">
          科目管理に戻る
        </Button>
      </div>
    );
  }

  const handleSaveSettings = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      // 設定を保存（実際の実装ではAPIに送信）
      console.log('科目設定を保存:', settings);
      // TODO: API実装
      alert('設定を保存しました');
    } catch (error) {
      console.error('設定の保存に失敗:', error);
      alert('設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTaskTemplate = async () => {
    if (!newTaskTemplate.title || !currentUser || !testPeriod) return;
    
    setSaving(true);
    try {
      if (newTaskTemplate.isSplitTask && newTaskTemplate.totalUnits && newTaskTemplate.dailyUnits && newTaskTemplate.unitType) {
        // 分割タスクを作成
        await createSplitTask(
          {
            title: newTaskTemplate.title,
            description: newTaskTemplate.description || '',
            subject: subject,
            priority: newTaskTemplate.priority || 'medium',
            status: 'not_started',
            dueDate: new Date(testPeriod.endDate).toISOString(),
            estimatedTime: newTaskTemplate.estimatedTime || 30,
            testPeriodId: testPeriod.id,
            assignedTo: currentUser.id, // 先生自身に割り当て（テンプレート用）
            createdBy: currentUser.id,
            taskType: 'parent',
            isShared: true,
            gradeId: testPeriod.classId,
          },
          newTaskTemplate.totalUnits,
          newTaskTemplate.unitType,
          newTaskTemplate.dailyUnits,
          newTaskTemplate.rangeStart,
          newTaskTemplate.rangeEnd
        );
      } else {
        // 通常のタスクを作成
        await createTask({
          title: newTaskTemplate.title,
          description: newTaskTemplate.description || '',
          subject: subject,
          priority: newTaskTemplate.priority || 'medium',
          status: 'not_started',
          dueDate: new Date(testPeriod.endDate).toISOString(),
          estimatedTime: newTaskTemplate.estimatedTime || 30,
          testPeriodId: testPeriod.id,
          assignedTo: currentUser.id, // 先生自身に割り当て（テンプレート用）
          createdBy: currentUser.id,
          taskType: 'single',
          isShared: true,
          gradeId: testPeriod.classId,
        });
      }

      // テンプレートリストに追加
      const template: TaskTemplate = {
        id: `template-${Date.now()}`,
        title: newTaskTemplate.title || '',
        description: newTaskTemplate.description || '',
        priority: newTaskTemplate.priority || 'medium',
        estimatedTime: newTaskTemplate.estimatedTime || 30,
        isSplitTask: newTaskTemplate.isSplitTask || false,
        totalUnits: newTaskTemplate.totalUnits,
        unitType: newTaskTemplate.unitType,
        dailyUnits: newTaskTemplate.dailyUnits,
        rangeStart: newTaskTemplate.rangeStart,
        rangeEnd: newTaskTemplate.rangeEnd,
      };

      setSettings(prev => prev ? {
        ...prev,
        taskTemplates: [...prev.taskTemplates, template]
      } : null);

      setNewTaskTemplate({});
      setShowTaskTemplateForm(false);
      alert('タスクテンプレートを作成しました');
    } catch (error) {
      console.error('タスクテンプレートの作成に失敗:', error);
      alert('タスクテンプレートの作成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTaskTemplate = (templateId: string) => {
    setSettings(prev => prev ? {
      ...prev,
      taskTemplates: prev.taskTemplates.filter(t => t.id !== templateId)
    } : null);
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{subject} 科目設定</h1>
          <div className="mt-1 text-sm text-gray-600">
            <span className="font-medium">学校:</span> {schools.find(s => s.grades.some(g => g.id === testPeriod.classId))?.name || '不明'}
            <span className="mx-2">|</span>
            <span className="font-medium">学年:</span> {schools.find(s => s.grades.some(g => g.id === testPeriod.classId))?.grades.find(g => g.id === testPeriod.classId)?.name || '不明'}
            <span className="mx-2">|</span>
            <span className="font-medium">テスト期間:</span> {testPeriod.title}
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/subjects')}
          >
            科目管理に戻る
          </Button>
          <Button
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? '保存中...' : '設定を保存'}
          </Button>
        </div>
      </div>

      {/* 設定状況 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${settings?.isConfigured ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span>設定状況</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            {settings?.isConfigured ? '科目設定が完了しています' : '科目設定が未完了です'}
          </p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${settings?.taskTemplates.length ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <span className="text-sm">タスクテンプレート: {settings?.taskTemplates.length || 0}個</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${actualTasks.length ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
              <span className="text-sm">実際のタスク: {actualTasks.length}個</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${settings?.distributionSettings.autoDistribute ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <span className="text-sm">配布設定: {settings?.distributionSettings.autoDistribute ? '有効' : '無効'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 実際のタスクデータ */}
      <Card>
        <CardHeader>
          <CardTitle>実際のタスクデータ ({actualTasks.length}個)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {actualTasks.map((task) => (
              <div key={task.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium">{task.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <span>優先度: {task.priority}</span>
                      <span>見積もり時間: {task.estimatedTime}分</span>
                      <span>ステータス: {task.status}</span>
                      <span>タスクタイプ: {task.taskType}</span>
                      {task.isShared && <span className="text-blue-600">共有タスク</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {actualTasks.length === 0 && (
              <p className="text-gray-500 text-center py-4">タスクがありません</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* タスクテンプレート管理 */}
      <Card>
        <CardHeader>
          <CardTitle>タスクテンプレート</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {settings?.taskTemplates.map((template) => (
              <div key={template.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium">{template.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <span>優先度: {template.priority}</span>
                      <span>見積もり時間: {template.estimatedTime}分</span>
                      {template.isSplitTask && (
                        <span>分割タスク: {template.totalUnits}{template.unitType}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveTaskTemplate(template.id)}
                  >
                    削除
                  </Button>
                </div>
              </div>
            ))}

            {!showTaskTemplateForm ? (
              <Button
                variant="outline"
                onClick={() => setShowTaskTemplateForm(true)}
                className="w-full"
              >
                タスクテンプレートを追加
              </Button>
            ) : (
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium">新しいタスクテンプレート</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    name="title"
                    label="タスク名"
                    value={newTaskTemplate.title || ''}
                    onChange={(e) => setNewTaskTemplate(prev => ({ ...prev, title: e.target.value }))}
                    fullWidth
                  />
                  <Select
                    name="priority"
                    label="優先度"
                    value={newTaskTemplate.priority || 'medium'}
                    onChange={(e) => setNewTaskTemplate(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
                    options={[
                      { value: 'low', label: '低' },
                      { value: 'medium', label: '中' },
                      { value: 'high', label: '高' },
                    ]}
                    fullWidth
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">説明</label>
                  <textarea
                    className="w-full border rounded px-3 py-2"
                    rows={3}
                    value={newTaskTemplate.description || ''}
                    onChange={(e) => setNewTaskTemplate(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="タスクの詳細説明"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    type="number"
                    name="estimatedTime"
                    label="見積もり時間（分）"
                    value={newTaskTemplate.estimatedTime || ''}
                    onChange={(e) => setNewTaskTemplate(prev => ({ ...prev, estimatedTime: parseInt(e.target.value) || 0 }))}
                    fullWidth
                  />
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isSplitTask"
                      checked={newTaskTemplate.isSplitTask || false}
                      onChange={(e) => setNewTaskTemplate(prev => ({ ...prev, isSplitTask: e.target.checked }))}
                    />
                    <label htmlFor="isSplitTask" className="text-sm font-medium text-gray-700">
                      分割タスク
                    </label>
                  </div>
                </div>
                {newTaskTemplate.isSplitTask && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      type="number"
                      name="totalUnits"
                      label="総量"
                      value={newTaskTemplate.totalUnits || ''}
                      onChange={(e) => setNewTaskTemplate(prev => ({ ...prev, totalUnits: parseInt(e.target.value) || 0 }))}
                      fullWidth
                    />
                    <Select
                      name="unitType"
                      label="単位"
                      value={newTaskTemplate.unitType || 'pages'}
                      onChange={(e) => setNewTaskTemplate(prev => ({ ...prev, unitType: e.target.value as 'pages' | 'problems' | 'hours' | 'sections' }))}
                      options={[
                        { value: 'pages', label: 'ページ' },
                        { value: 'problems', label: '問題' },
                        { value: 'hours', label: '時間' },
                        { value: 'sections', label: 'セクション' },
                      ]}
                      fullWidth
                    />
                    <Input
                      type="number"
                      name="dailyUnits"
                      label="1日あたりの量"
                      value={newTaskTemplate.dailyUnits || ''}
                      onChange={(e) => setNewTaskTemplate(prev => ({ ...prev, dailyUnits: parseInt(e.target.value) || 0 }))}
                      fullWidth
                    />
                  </div>
                )}
                <div className="flex space-x-2">
                  <Button onClick={handleAddTaskTemplate} className="flex-1">
                    追加
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowTaskTemplateForm(false);
                      setNewTaskTemplate({});
                    }}
                    className="flex-1"
                  >
                    キャンセル
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 配布設定 */}
      <Card>
        <CardHeader>
          <CardTitle>配布設定</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoDistribute"
                checked={settings?.distributionSettings.autoDistribute || false}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  distributionSettings: {
                    ...prev.distributionSettings,
                    autoDistribute: e.target.checked
                  }
                } : null)}
              />
              <label htmlFor="autoDistribute" className="text-sm font-medium text-gray-700">
                自動配布を有効にする
              </label>
            </div>
            
            {settings?.distributionSettings.autoDistribute && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="date"
                  name="distributionDate"
                  label="配布日"
                  value={settings.distributionSettings.distributionDate}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    distributionSettings: {
                      ...prev.distributionSettings,
                      distributionDate: e.target.value
                    }
                  } : null)}
                  fullWidth
                />
                <Input
                  type="number"
                  name="reminderDays"
                  label="リマインダー日数"
                  value={settings.distributionSettings.reminderDays}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    distributionSettings: {
                      ...prev.distributionSettings,
                      reminderDays: parseInt(e.target.value) || 1
                    }
                  } : null)}
                  fullWidth
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="allowStudentModification"
                checked={settings?.distributionSettings.allowStudentModification || false}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  distributionSettings: {
                    ...prev.distributionSettings,
                    allowStudentModification: e.target.checked
                  }
                } : null)}
              />
              <label htmlFor="allowStudentModification" className="text-sm font-medium text-gray-700">
                生徒によるタスクの変更を許可する
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 完了ボタン */}
      <Card>
        <CardContent className="text-center py-6">
          <Button
            onClick={() => {
              setSettings(prev => prev ? { ...prev, isConfigured: true } : null);
              handleSaveSettings();
            }}
            disabled={!settings?.taskTemplates.length}
            className="w-full max-w-md"
          >
            科目設定を完了する
          </Button>
          <p className="text-sm text-gray-500 mt-2">
            タスクテンプレートを1つ以上追加してから完了してください
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
