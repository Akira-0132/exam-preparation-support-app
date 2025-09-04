'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface ProgressGaugeProps {
  title: string;
  progress: number; // 0-100の進捗率
  total: number;
  completed: number;
  color?: 'blue' | 'green' | 'purple' | 'orange';
  icon?: React.ReactNode;
}

export default function ProgressGauge({ 
  title, 
  progress, 
  total, 
  completed, 
  color = 'blue',
  icon 
}: ProgressGaugeProps) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const colorClasses = {
    blue: {
      stroke: 'stroke-blue-500',
      text: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    green: {
      stroke: 'stroke-green-500',
      text: 'text-green-600',
      bg: 'bg-green-50',
    },
    purple: {
      stroke: 'stroke-purple-500',
      text: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    orange: {
      stroke: 'stroke-orange-500',
      text: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  };

  const currentColorClass = colorClasses[color];

  return (
    <Card variant="outlined" className={currentColorClass.bg}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-sm font-medium text-gray-700">
          {icon && <span className={currentColorClass.text}>{icon}</span>}
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center relative">
          {/* 円形プログレスバー */}
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            {/* 背景の円 */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-gray-200"
            />
            {/* 進捗の円 */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={`${currentColorClass.stroke} transition-all duration-1000 ease-in-out`}
            />
          </svg>
          
          {/* 中央のテキスト */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className={`text-xl font-bold ${currentColorClass.text}`}>
                {Math.round(progress)}%
              </div>
            </div>
          </div>
        </div>

        {/* 詳細統計 */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">完了済み</span>
            <span className="font-medium text-gray-900">{completed}個</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">総タスク数</span>
            <span className="font-medium text-gray-900">{total}個</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">残り</span>
            <span className="font-medium text-gray-900">{total - completed}個</span>
          </div>
        </div>

        {/* プログレスバー（線形） */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-1000 ease-in-out ${currentColorClass.stroke.replace('stroke-', 'bg-')}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* ステータスメッセージ */}
        <div className="mt-3 text-center">
          {progress === 100 ? (
            <span className="text-sm font-medium text-green-600">
              ✅ 完了！
            </span>
          ) : progress >= 75 ? (
            <span className="text-sm font-medium text-blue-600">
              もう少しで完了！
            </span>
          ) : progress >= 50 ? (
            <span className="text-sm font-medium text-orange-600">
              半分完了
            </span>
          ) : progress > 0 ? (
            <span className="text-sm font-medium text-gray-600">
              取り組み中
            </span>
          ) : (
            <span className="text-sm font-medium text-gray-500">
              未開始
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}