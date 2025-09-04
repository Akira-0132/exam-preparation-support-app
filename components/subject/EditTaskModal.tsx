'use client';

import { useState, useEffect } from 'react';
import { Task } from '@/types';
import { useDashboard } from '@/lib/context/DashboardContext';
import { createSubtask, updateTask, deleteTask } from '@/lib/supabase/tasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parentTask: Task; // 編集対象のメインタスク
  existingSubtasks?: Task[]; // 既存サブタスク表示用
}

export default function EditTaskModal({ isOpen, onClose, onSuccess, parentTask, existingSubtasks = [] }: EditTaskModalProps) {
  const { currentTestPeriod } = useDashboard();
  const [title, setTitle] = useState(parentTask.title);
  const [description, setDescription] = useState(parentTask.description || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 追加するサブタスク（ページ範囲など複数）
  type RangeItem = { id: string; label: string; totalUnits?: number; unitType?: 'pages' | 'problems' | 'hours' | 'sections'; startPage?: number; endPage?: number };
  const [ranges, setRanges] = useState<RangeItem[]>([]);

  // 既存サブタスクの編集用状態
  type EditableSubtask = {
    id: string;
    title: string;
    unitType: 'pages' | 'problems' | 'hours' | 'sections' | undefined;
    totalUnits?: number | undefined;
    startPage?: number | undefined;
    endPage?: number | undefined;
    dueDate: string; // ISO yyyy-mm-dd
    editDue: boolean;
  };
  const [editableSubtasks, setEditableSubtasks] = useState<EditableSubtask[]>([]);

  useEffect(() => {
    if (isOpen) {
      setTitle(parentTask.title);
      setDescription(parentTask.description || '');
      setRanges([]);
      setErrors({});
      // 初期化: 既存サブタスク編集用
      const defaultDue = (() => {
        if (!currentTestPeriod?.startDate) return parentTask.dueDate;
        const d = new Date(currentTestPeriod.startDate);
        d.setDate(d.getDate() - 1);
        d.setHours(0,0,0,0);
        return d.toISOString();
      })();
      setEditableSubtasks(existingSubtasks.map(st => ({
        id: st.id,
        title: st.title,
        unitType: st.unitType,
        totalUnits: st.totalUnits,
        // ページ数のときは範囲未入力から始める（任意入力）
        startPage: undefined,
        endPage: undefined,
        dueDate: (st.dueDate ? st.dueDate : defaultDue).split('T')[0],
        editDue: false,
      })));
    }
  }, [isOpen, parentTask, existingSubtasks, currentTestPeriod]);

  const addRange = () => {
    setRanges(prev => [
      ...prev,
      { id: crypto.randomUUID(), label: '', totalUnits: undefined, unitType: 'pages', startPage: undefined, endPage: undefined }
    ]);
  };

  const removeRange = (id: string) => {
    setRanges(prev => prev.filter(r => r.id !== id));
  };

  const updateRange = (id: string, patch: Partial<RangeItem>) => {
    setRanges(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const updateEditable = (id: string, patch: Partial<EditableSubtask>) => {
    setEditableSubtasks(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'タイトルを入力してください';
    for (const r of ranges) {
      if (!r.label.trim()) {
        e[`range-${r.id}`] = '範囲を入力してください（例: p12-24 や p90-120）';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // メインタスクのタイトル・説明の更新
      await updateTask(parentTask.id, { title, description });

      // 追加するサブタスクの作成
      const defaultDueISO = (() => {
        if (!currentTestPeriod?.startDate) return parentTask.dueDate;
        const d = new Date(currentTestPeriod.startDate);
        d.setDate(d.getDate() - 1);
        d.setHours(0,0,0,0);
        return d.toISOString();
      })();

      for (const r of ranges) {
        // ラベルから単位数を推定できないため、totalUnitsは任意入力とし、未入力はundefinedのまま
        let totalUnits = r.totalUnits;
        if (r.unitType === 'pages' && r.startPage && r.endPage && r.endPage >= r.startPage) {
          totalUnits = r.endPage - r.startPage + 1;
        }
        await createSubtask({
          parentTaskId: parentTask.id,
          title: r.label,
          description: '',
          subject: parentTask.subject,
          assignedTo: parentTask.assignedTo,
          createdBy: parentTask.createdBy,
          testPeriodId: parentTask.testPeriodId,
          dueDate: defaultDueISO,
          totalUnits,
          unitType: r.unitType,
        });
      }

      // 既存サブタスクの更新
      for (const s of editableSubtasks) {
        let totalUnits = s.totalUnits;
        if (s.unitType === 'pages' && s.startPage && s.endPage && s.endPage >= s.startPage) {
          totalUnits = s.endPage - s.startPage + 1;
        }
        const dueISO = s.dueDate ? new Date(s.dueDate + 'T00:00:00').toISOString() : undefined;
        await updateTask(s.id, {
          title: s.title,
          unitType: s.unitType,
          totalUnits,
          dueDate: dueISO,
        } as any);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('保存に失敗しました', err);
      setErrors(prev => ({ ...prev, submit: '保存に失敗しました。もう一度お試しください。' }));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>メインタスクの編集 / サブタスクの追加</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                label="タイトル"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={errors.title}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">詳細（任意）</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="border-t pt-4">
                {/* 既存サブタスクの一覧 */}
                {existingSubtasks.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">既存のサブタスク</h3>
                    <div className="space-y-3 divide-y divide-gray-100">
                      {editableSubtasks.map((st) => {
                        const isPages = st.unitType === 'pages';
                        return (
                          <div key={st.id} className="rounded-md border border-gray-200 p-3 bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                              <div className={isPages ? 'md:col-span-3' : 'md:col-span-4'}>
                                <Input label="タイトル" fullWidth value={st.title} onChange={(e)=>updateEditable(st.id,{title:e.target.value})} />
                              </div>
                              <div className="md:col-span-2">
                                <Select
                                  label="単位"
                                  name="unitType"
                                  value={st.unitType || 'pages'}
                                  onChange={(e)=>updateEditable(st.id,{unitType: e.target.value as any})}
                                  fullWidth
                                  options={[
                                    { value: 'pages', label: 'ページ' },
                                    { value: 'problems', label: '問題' },
                                    { value: 'hours', label: '時間' },
                                    { value: 'sections', label: 'セクション' },
                                  ]}
                                />
                              </div>
                              {isPages ? (
                                <>
                                  <div className="md:col-span-2">
                                    <Input type="number" label="開始ページ" fullWidth value={(st.startPage??'').toString()} onChange={(e)=>updateEditable(st.id,{startPage: parseInt(e.target.value)||undefined})} />
                                  </div>
                                  <div className="md:col-span-2">
                                    <Input type="number" label="終了ページ" fullWidth value={(st.endPage??'').toString()} onChange={(e)=>updateEditable(st.id,{endPage: parseInt(e.target.value)||undefined})} />
                                  </div>
                                </>
                              ) : (
                                <div className="md:col-span-3">
                                  <Input type="number" label="総量" fullWidth value={(st.totalUnits??'').toString()} onChange={(e)=>updateEditable(st.id,{ totalUnits: parseInt(e.target.value)||undefined })} />
                                </div>
                              )}
                              <div className={isPages ? 'md:col-span-5' : 'md:col-span-3'}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">期限</label>
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="date"
                                    value={st.dueDate}
                                    onChange={(e)=>updateEditable(st.id,{dueDate:e.target.value})}
                                    disabled={!st.editDue}
                                    max={( ()=>{ if(!currentTestPeriod?.startDate) return undefined as any; const d=new Date(currentTestPeriod.startDate); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0];})()}
                                    className={`border rounded px-2 py-1 text-sm w-full md:w-40 ${st.editDue? 'bg-white':'bg-gray-100'}`}
                                  />
                                  <Button size="sm" variant="outline" onClick={()=>updateEditable(st.id,{editDue: !st.editDue})}>{st.editDue?'ロック':'編集'}</Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={async () => {
                                      if (!confirm('このサブタスクを削除しますか？')) return;
                                      try { await deleteTask(st.id); onSuccess(); } catch(e){ console.error(e); }
                                    }}
                                  >削除</Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">サブタスク（範囲を複数追加）</h3>
                  <Button type="button" size="sm" variant="outline" onClick={addRange}>範囲を追加</Button>
                </div>

                <div className="space-y-3">
                  {ranges.map((r) => (
                    <div key={r.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-6">
                        <Input
                          label="範囲（例: p12-24, p90-120 など）"
                          value={r.label}
                          onChange={(e) => updateRange(r.id, { label: e.target.value })}
                          error={errors[`range-${r.id}`]}
                          placeholder="p12-24"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Select
                          label="単位"
                          name="unitType"
                          value={r.unitType || 'pages'}
                          onChange={(e) => updateRange(r.id, { unitType: e.target.value as any })}
                          className="w-28"
                          options={[
                            { value: 'pages', label: 'ページ' },
                            { value: 'problems', label: '問題' },
                            { value: 'hours', label: '時間' },
                            { value: 'sections', label: 'セクション' },
                          ]}
                        />
                      </div>
                      {r.unitType === 'pages' ? (
                        <>
                          <div className="md:col-span-2">
                            <Input type="number" label="開始ページ" className="w-28" value={(r.startPage??'').toString()} onChange={(e)=>updateRange(r.id,{startPage: parseInt(e.target.value)||undefined})} />
                          </div>
                          <div className="md:col-span-2">
                            <Input type="number" label="終了ページ" className="w-28" value={(r.endPage??'').toString()} onChange={(e)=>updateRange(r.id,{endPage: parseInt(e.target.value)||undefined})} />
                          </div>
                        </>
                      ) : (
                        <div className="md:col-span-3">
                          <Input
                            type="number"
                            label="総量（任意）"
                            value={(r.totalUnits ?? '').toString()}
                            onChange={(e) => updateRange(r.id, { totalUnits: parseInt(e.target.value) || undefined })}
                            placeholder="（例）13"
                          />
                        </div>
                      )}
                      <div className="md:col-span-1 flex justify-end">
                        <Button size="sm" type="button" variant="danger" onClick={() => removeRange(r.id)}>削除</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {errors.submit && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  {errors.submit}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <Button variant="outline" onClick={onClose} disabled={saving}>キャンセル</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


