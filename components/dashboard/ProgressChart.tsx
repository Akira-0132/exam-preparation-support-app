'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Statistics } from '@/types';

interface ProgressChartProps {
  statistics: Statistics;
  className?: string;
}

export default function ProgressChart({ statistics, className = '' }: ProgressChartProps) {
  const completionPercentage = statistics.completionRate || 0;
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (completionPercentage / 100) * circumference;

  const getProgressColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-blue-600';
    if (rate >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressBgColor = (rate: number) => {
    if (rate >= 80) return 'stroke-green-500';
    if (rate >= 60) return 'stroke-blue-500';
    if (rate >= 40) return 'stroke-yellow-500';
    return 'stroke-red-500';
  };

  return (
    <div className={className}>
      <Card variant="outlined">
        <CardHeader>
          <CardTitle>進捗状況</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* 円形プログレス */}
            <div className="flex items-center justify-center">
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                  {/* 背景の円 */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-gray-200"
                  />
                  {/* 進捗の円 */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className={`${getProgressBgColor(completionPercentage)} transition-all duration-1000 ease-in-out`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getProgressColor(completionPercentage)}`}>
                      {completionPercentage}%
                    </div>
                    <div className="text-xs text-gray-500">完了率</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 統計情報 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">
                  {statistics.completedTasks}
                </div>
                <div className="text-sm text-gray-600">完了済み</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">
                  {statistics.totalTasks}
                </div>
                <div className="text-sm text-gray-600">総タスク数</div>
              </div>
            </div>

            {/* 詳細統計 */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">平均所要時間</span>
                <span className="text-sm font-medium">
                  {statistics.averageTimePerTask > 0 
                    ? `${Math.round(statistics.averageTimePerTask)}分` 
                    : '-'
                  }
                </span>
              </div>
              
              {/* 生産性スコアは非表示に変更 */}
            </div>

            {/* 週間進捗 */}
            {statistics.weeklyProgress && statistics.weeklyProgress.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">週間進捗</h4>
                <div className="space-y-2">
                  {statistics.weeklyProgress.map((day, index) => {
                    const dayProgress = day.total > 0 ? (day.completed / day.total) * 100 : 0;
                    return (
                      <div key={index} className="flex items-center space-x-3">
                        <div className="text-xs text-gray-500 w-16">
                          {new Date(day.date).toLocaleDateString('ja-JP', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getProgressBgColor(dayProgress).replace('stroke-', 'bg-')}`}
                            style={{ width: `${dayProgress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-600 w-12 text-right">
                          {day.completed}/{day.total}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}