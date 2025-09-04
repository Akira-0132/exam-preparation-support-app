'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface Step2Props {
  onNext: (data: Step2Data) => void;
  onBack: () => void;
  initialData?: Step2Data;
}

export interface Step2Data {
  selectedSubjects: string[];
}

export default function Step2({ onNext, onBack, initialData }: Step2Props) {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    initialData?.selectedSubjects || []
  );
  const [errors, setErrors] = useState<string>('');

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

  const validateForm = (): boolean => {
    if (selectedSubjects.length === 0) {
      setErrors('少なくとも1科目を選択してください');
      return false;
    }
    setErrors('');
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onNext({ selectedSubjects });
    }
  };

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjects(prev => {
      if (prev.includes(subjectId)) {
        return prev.filter(id => id !== subjectId);
      } else {
        return [...prev, subjectId];
      }
    });
    
    // エラーがある場合はクリア
    if (errors) {
      setErrors('');
    }
  };

  const selectAllSubjects = () => {
    setSelectedSubjects(availableSubjects.map(subject => subject.id));
    setErrors('');
  };

  const clearAllSubjects = () => {
    setSelectedSubjects([]);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>試験科目の選択</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 説明 */}
            <div className="text-gray-600">
              <p>今回のテスト期間で勉強する科目を選択してください。</p>
              <p className="text-sm mt-1">選択した科目ごとに学習計画を立てることができます。</p>
            </div>

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

            {/* エラーメッセージ */}
            {errors && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{errors}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 科目選択グリッド */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableSubjects.map((subject) => {
                const isSelected = selectedSubjects.includes(subject.id);
                return (
                  <div
                    key={subject.id}
                    onClick={() => toggleSubject(subject.id)}
                    className={`
                      relative cursor-pointer rounded-lg border-2 p-4 hover:bg-gray-50 transition-all
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
                        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
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
              <div className="bg-green-50 rounded-lg p-4">
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

            {/* 注意事項 */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">ヒント</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>選択した科目ごとに個別の学習計画を立てることができます</li>
                      <li>後から科目を追加・削除することも可能です</li>
                      <li>まずは主要科目から選択することをお勧めします</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ナビゲーションボタン */}
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
              >
                戻る
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={selectedSubjects.length === 0}
              >
                次へ進む
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}