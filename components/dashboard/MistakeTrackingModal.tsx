'use client';

import { useState, useEffect } from 'react';
import { Task } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface MistakeTrackingModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (mistakePages: number[]) => void;
}

export default function MistakeTrackingModal({
  task,
  isOpen,
  onClose,
  onComplete
}: MistakeTrackingModalProps) {
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [manualInput, setManualInput] = useState<string>('');
  const [inputError, setInputError] = useState<string>('');
  const [manualPages, setManualPages] = useState<number[]>([]);
  const [noMistakes, setNoMistakes] = useState<boolean>(false);
  const [understoodMistakes, setUnderstoodMistakes] = useState<boolean>(false);

  useEffect(() => {
    if (task && isOpen) {
      // タスクのページ範囲を解析
      const pages = extractPageNumbers(task);
      setSelectedPages([]);
      setManualInput('');
      setInputError('');
      setManualPages([]);
      setNoMistakes(false);
      setUnderstoodMistakes(false);
    }
  }, [task, isOpen]);

  const extractPageNumbers = (task: Task): number[] => {
    // タスクのタイトルや説明からページ範囲を抽出
    // パターン1: 日本語表記「13〜30ページ」「13-30ページ」「13～30ページ」など
    const jpRangeRegex = /(\d+)\s*[〜~\-ー～]\s*(\d+)\s*ページ/;
    const titleJp = task.title.match(jpRangeRegex);
    const descJp = task.description ? task.description.match(jpRangeRegex) : null;
    const jp = titleJp || descJp;
    if (jp) {
      const start = parseInt(jp[1], 10);
      const end = parseInt(jp[2], 10);
      if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
      }
    }

    // パターン2: 英語表記「p.12-14」
    const enRange = task.title.match(/p\.(\d+)\s*[-~]\s*(\d+)/i);
    if (enRange) {
      const start = parseInt(enRange[1], 10);
      const end = parseInt(enRange[2], 10);
      if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
      }
    }

    // パターン3: 単一ページ「p.12」
    const singlePageMatch = task.title.match(/p\.(\d+)/i);
    if (singlePageMatch) {
      const page = parseInt(singlePageMatch[1], 10);
      if (!Number.isNaN(page)) return [page];
    }

    return [];
  };

  const togglePage = (page: number) => {
    setSelectedPages(prev =>
      prev.includes(page)
        ? prev.filter(p => p !== page)
        : [...prev, page]
    );
    // ページを選択した場合は「間違いなし」を無効化
    if (!selectedPages.includes(page)) {
      setNoMistakes(false);
    }
    // ページ選択が変更されたら理解確認をリセット
    setUnderstoodMistakes(false);
  };

  const validateSinglePageInput = (input: string): { isValid: boolean; error: string; page: number | null } => {
    if (!input.trim()) {
      return { isValid: true, error: '', page: null };
    }

    // 半角数字のみを許可
    const validPattern = /^[0-9]+$/;
    
    if (!validPattern.test(input)) {
      return { 
        isValid: false, 
        error: '半角数字のみ入力してください', 
        page: null 
      };
    }

    const pageNum = parseInt(input, 10);
    if (isNaN(pageNum) || pageNum <= 0) {
      return { 
        isValid: false, 
        error: '1以上の数字を入力してください', 
        page: null 
      };
    }

    // 既に選択済みかチェック
    if (selectedPages.includes(pageNum) || manualPages.includes(pageNum)) {
      return { 
        isValid: false, 
        error: '既に選択されているページです', 
        page: null 
      };
    }

    return { isValid: true, error: '', page: pageNum };
  };

  const handleManualInputChange = (value: string) => {
    setManualInput(value);
    setInputError('');
    
    const validation = validateSinglePageInput(value);
    if (!validation.isValid) {
      setInputError(validation.error);
    }
  };

  const addManualPage = () => {
    const validation = validateSinglePageInput(manualInput);
    if (!validation.isValid) {
      setInputError(validation.error);
      return;
    }

    if (validation.page) {
      setManualPages(prev => [...prev, validation.page!]);
      setManualInput('');
      setInputError('');
      // 手動でページを追加した場合は「間違いなし」を無効化
      setNoMistakes(false);
      // ページ追加時は理解確認をリセット
      setUnderstoodMistakes(false);
    }
  };

  const removeManualPage = (pageToRemove: number) => {
    setManualPages(prev => prev.filter(page => page !== pageToRemove));
    // ページ削除時は理解確認をリセット
    setUnderstoodMistakes(false);
  };

  const handleNoMistakesChange = (checked: boolean) => {
    setNoMistakes(checked);
    // 「間違いなし」をチェックした場合は選択されたページをクリア
    if (checked) {
      setSelectedPages([]);
      setManualPages([]);
      setUnderstoodMistakes(false);
    }
  };

  const handleComplete = () => {
    const allSelectedPages = [...selectedPages, ...manualPages];
    onComplete(allSelectedPages);
    onClose();
  };

  if (!isOpen || !task) return null;

  const pages = extractPageNumbers(task);
  const hasPages = pages.length > 0;
  const getStageInfo = (cycle: number, stage: string) => {
    const stages: Record<string, { label: string; icon: string; color: string }> = {
      'overview': { label: '全体確認', icon: '🔍', color: 'text-blue-600' },
      'review': { label: '間違い直し', icon: '🔧', color: 'text-orange-600' },
      'mastery': { label: '総復習', icon: '🎯', color: 'text-green-600' }
    };
    return stages[stage] || stages['overview'];
  };

  const stageInfo = getStageInfo(task.cycleNumber || 1, task.learningStage || 'overview');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <Card className="w-full max-w-md mx-4 my-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span className="text-lg">{stageInfo.icon}</span>
            <span>学習完了の記録</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[80vh] overflow-y-auto">
          {/* タスク情報 */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <span className={`text-sm font-medium ${stageInfo.color}`}>
                {stageInfo.icon} {stageInfo.label}
              </span>
              <span className="text-xs text-gray-500">
                {task.cycleNumber || 1}周目
              </span>
            </div>
            <h3 className="font-medium text-gray-900">{task.title}</h3>
            <p className="text-sm text-gray-600">{task.description}</p>
          </div>

          {/* 間違えたページ選択 */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">
              間違えたページを選択してください
            </h4>
            
            {/* 間違えたページの候補 */}
            {hasPages && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  間違えたページの候補: {pages.length}ページ
                </p>
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                  {pages.map(page => (
                    <button
                      key={page}
                      onClick={() => togglePage(page)}
                      className={`p-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                        selectedPages.includes(page)
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      p.{page}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 手動入力 */}
            <div className="border-t pt-4">
              <h5 className="font-medium text-gray-900 mb-2">
                候補にない場合は、手動でページ番号を追加
              </h5>
              <div className="space-y-3">
                {/* 入力フィールドと追加ボタン */}
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={manualInput}
                    onChange={(e) => handleManualInputChange(e.target.value)}
                    placeholder="ページ番号"
                    min="1"
                    className={`flex-1 px-3 py-2 border rounded-lg text-sm ${
                      inputError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addManualPage}
                    disabled={!manualInput.trim() || !!inputError}
                    className="px-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </Button>
                </div>
                
                {inputError && (
                  <p className="text-sm text-red-600">{inputError}</p>
                )}

                {/* 手動追加されたページ一覧 */}
                {manualPages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">追加したページ:</p>
                    <div className="flex flex-wrap gap-2">
                      {manualPages.map(page => (
                        <div
                          key={page}
                          className="flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm"
                        >
                          <span>p.{page}</span>
                          <button
                            onClick={() => removeManualPage(page)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  <p><strong>入力規則:</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>半角数字のみ入力</li>
                    <li>1以上の数字を入力</li>
                    <li>重複は不可</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 選択結果表示 */}
            {(selectedPages.length > 0 || manualPages.length > 0) && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  選択中のページ:
                </p>
                <p className="text-sm text-blue-700">
                  {[...selectedPages, ...manualPages].sort((a, b) => a - b).map(p => `p.${p}`).join(', ')}
                </p>
              </div>
            )}

            {/* 理解確認チェックボックス */}
            {(selectedPages.length > 0 || manualPages.length > 0) && (
              <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={understoodMistakes}
                    onChange={(e) => setUnderstoodMistakes(e.target.checked)}
                    className="checkbox-strong"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-900">
                      📚 間違えた問題の解き方を確認しましたか？
                    </p>
                    <p className="text-xs text-orange-700">
                      解説や答えを参考に理解し直しました
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* 間違いがない場合のオプション */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noMistakes}
                  onChange={(e) => handleNoMistakesChange(e.target.checked)}
                  disabled={selectedPages.length > 0 || manualPages.length > 0}
                  className="checkbox-strong"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    ✅ 間違えた問題はありません
                  </p>
                  <p className="text-xs text-gray-600">
                    このタスクは完璧に解けました
                  </p>
                </div>
              </label>
              {selectedPages.length > 0 || manualPages.length > 0 ? (
                <p className="text-xs text-gray-500 mt-2">
                  ※ 間違えたページを選択しているため、このオプションは選択できません
                </p>
              ) : null}
            </div>

            {/* 解析失敗時の案内 */}
            {!hasPages && (
              <div className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg">
                <p className="font-medium mb-1">ページ範囲が自動解析できませんでした</p>
                <p>手動入力でページ番号を指定してください。</p>
              </div>
            )}
          </div>

          {/* 説明 */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>次のステップ:</strong><br />
              間違えたページは2周目の「間違い直し」タスクとして追加されます。
            </p>
          </div>

          {/* ボタン */}
          <div className="flex space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              onClick={handleComplete}
              className="flex-1"
              disabled={
                (selectedPages.length === 0 && manualPages.length === 0 && !noMistakes) ||
                ((selectedPages.length > 0 || manualPages.length > 0) && !understoodMistakes)
              }
            >
              完了として記録
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
