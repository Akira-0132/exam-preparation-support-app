'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';

interface Step3Props {
  subjects: string[];
  onNext: (data: Step3Data) => void;
  onBack: () => void;
  initialData?: Step3Data;
}

export interface Step3Data {
  subjectConfidence: Record<string, {
    confidence: number; // 1-5の自信度
    priority: 'high' | 'medium' | 'low'; // 優先度
    estimatedStudyTime: number; // 予想学習時間（時間）
  }>;
}

export default function Step3({ subjects, onNext, onBack, initialData }: Step3Props) {
  const [subjectData, setSubjectData] = useState<Step3Data['subjectConfidence']>(() => {
    const initial: Step3Data['subjectConfidence'] = {};
    
    subjects.forEach(subject => {
      initial[subject] = initialData?.subjectConfidence[subject] || {
        confidence: 3,
        priority: 'medium',
        estimatedStudyTime: 10,
      };
    });
    
    return initial;
  });

  const [errors, setErrors] = useState<string>('');

  const confidenceOptions = [
    { value: '1', label: '1 - とても不安' },
    { value: '2', label: '2 - 不安' },
    { value: '3', label: '3 - 普通' },
    { value: '4', label: '4 - 自信あり' },
    { value: '5', label: '5 - とても自信あり' },
  ];

  const priorityOptions = [
    { value: 'high', label: '高 - 重点的に学習' },
    { value: 'medium', label: '中 - 標準的に学習' },
    { value: 'low', label: '低 - 軽く復習' },
  ];

  const studyTimeOptions = [
    { value: '5', label: '5時間' },
    { value: '10', label: '10時間' },
    { value: '15', label: '15時間' },
    { value: '20', label: '20時間' },
    { value: '25', label: '25時間' },
    { value: '30', label: '30時間以上' },
  ];

  const validateForm = (): boolean => {
    // すべての科目で設定が完了しているかチェック
    const hasIncompleteData = subjects.some(subject => {
      const data = subjectData[subject];
      return !data || !data.confidence || !data.priority || !data.estimatedStudyTime;
    });

    if (hasIncompleteData) {
      setErrors('すべての科目で設定を完了してください');
      return false;
    }

    setErrors('');
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onNext({ subjectConfidence: subjectData });
    }
  };

  const handleSubjectDataChange = (subject: string, field: string, value: string | number) => {
    setSubjectData(prev => ({
      ...prev,
      [subject]: {
        ...prev[subject],
        [field]: typeof value === 'string' ? 
          (field === 'confidence' || field === 'estimatedStudyTime' ? parseInt(value) : value) : 
          value,
      },
    }));
    
    if (errors) {
      setErrors('');
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence <= 2) return 'text-red-600 bg-red-50';
    if (confidence === 3) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-blue-600 bg-blue-50';
      case 'low': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTotalEstimatedTime = () => {
    return Object.values(subjectData).reduce((total, data) => total + (data.estimatedStudyTime || 0), 0);
  };

  const getRecommendations = () => {
    const highPrioritySubjects = subjects.filter(subject => subjectData[subject]?.priority === 'high');
    const lowConfidenceSubjects = subjects.filter(subject => subjectData[subject]?.confidence <= 2);
    
    return {
      highPriorityCount: highPrioritySubjects.length,
      lowConfidenceCount: lowConfidenceSubjects.length,
      recommendations: [
        ...lowConfidenceSubjects.map(subject => `${subject}: 自信度が低いため、基礎から復習することをお勧めします`),
        ...highPrioritySubjects.map(subject => `${subject}: 高優先度に設定されています。十分な時間を確保しましょう`),
      ],
    };
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>科目別自信度・優先度設定</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 説明 */}
            <div className="text-gray-600">
              <p>各科目について、現在の自信度、学習優先度、予想学習時間を設定してください。</p>
              <p className="text-sm mt-1">この情報を基に個別の学習計画を提案します。</p>
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

            {/* 科目別設定 */}
            <div className="space-y-6">
              {subjects.map((subject) => {
                const data = subjectData[subject] || {};
                return (
                  <Card key={subject} variant="outlined" className="bg-gray-50">
                    <CardContent className="p-4">
                      <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                        <span>{subject}</span>
                        <div className="ml-auto flex space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(data.confidence || 3)}`}>
                            自信度: {data.confidence || 3}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(data.priority || 'medium')}`}>
                            優先度: {data.priority === 'high' ? '高' : data.priority === 'low' ? '低' : '中'}
                          </span>
                        </div>
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Select
                          name={`confidence-${subject}`}
                          label="現在の自信度"
                          value={(data.confidence || 3).toString()}
                          onChange={(e) => handleSubjectDataChange(subject, 'confidence', e.target.value)}
                          options={confidenceOptions}
                          fullWidth
                        />
                        
                        <Select
                          name={`priority-${subject}`}
                          label="学習優先度"
                          value={data.priority || 'medium'}
                          onChange={(e) => handleSubjectDataChange(subject, 'priority', e.target.value)}
                          options={priorityOptions}
                          fullWidth
                        />
                        
                        <Select
                          name={`studyTime-${subject}`}
                          label="予想学習時間"
                          value={(data.estimatedStudyTime || 10).toString()}
                          onChange={(e) => handleSubjectDataChange(subject, 'estimatedStudyTime', e.target.value)}
                          options={studyTimeOptions}
                          fullWidth
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* サマリー */}
            <Card variant="outlined" className="bg-blue-50">
              <CardContent className="p-4">
                <h3 className="font-medium text-blue-900 mb-3">学習計画サマリー</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-blue-800">総予想学習時間</div>
                    <div className="text-xl font-bold text-blue-900">{getTotalEstimatedTime()}時間</div>
                  </div>
                  <div>
                    <div className="font-medium text-blue-800">高優先度科目</div>
                    <div className="text-xl font-bold text-blue-900">{getRecommendations().highPriorityCount}科目</div>
                  </div>
                  <div>
                    <div className="font-medium text-blue-800">要強化科目</div>
                    <div className="text-xl font-bold text-blue-900">{getRecommendations().lowConfidenceCount}科目</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 推奨事項 */}
            {getRecommendations().recommendations.length > 0 && (
              <Card variant="outlined" className="bg-yellow-50">
                <CardContent className="p-4">
                  <h3 className="font-medium text-yellow-900 mb-3">学習のアドバイス</h3>
                  <ul className="space-y-2 text-sm text-yellow-800">
                    {getRecommendations().recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start">
                        <svg className="w-4 h-4 mt-0.5 mr-2 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {recommendation}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

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
              >
                設定を完了する
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}