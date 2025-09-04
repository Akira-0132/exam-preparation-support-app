// クラス名を結合するユーティリティ関数
export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

// 日付フォーマット関数
export const formatDate = (date: string | Date, format: 'short' | 'long' = 'short'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'short') {
    return dateObj.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  } else {
    return dateObj.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  }
};

// 時刻フォーマット関数
export const formatTime = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 相対時間表示（例: "2時間前", "明日"）
export const formatRelativeTime = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.ceil(diffMs / (1000 * 60));

  if (diffMinutes < 60 && diffMinutes > -60) {
    if (diffMinutes > 0) return `${diffMinutes}分後`;
    if (diffMinutes < 0) return `${Math.abs(diffMinutes)}分前`;
    return 'たった今';
  }

  if (diffHours < 24 && diffHours > -24) {
    if (diffHours > 0) return `${diffHours}時間後`;
    if (diffHours < 0) return `${Math.abs(diffHours)}時間前`;
  }

  if (diffDays === 1) return '明日';
  if (diffDays === -1) return '昨日';
  if (diffDays > 1) return `${diffDays}日後`;
  if (diffDays < -1) return `${Math.abs(diffDays)}日前`;

  return formatDate(dateObj);
};

// 時間（分）を読みやすい形式に変換
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}分`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) {
    return `${hours}時間`;
  }
  
  return `${hours}時間${mins}分`;
};

// 優先度のテキストと色を取得
export const getPriorityInfo = (priority: 'low' | 'medium' | 'high') => {
  switch (priority) {
    case 'low':
      return { text: '低', color: 'text-green-600', bgColor: 'bg-green-100' };
    case 'medium':
      return { text: '中', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    case 'high':
      return { text: '高', color: 'text-red-600', bgColor: 'bg-red-100' };
    default:
      return { text: '低', color: 'text-gray-600', bgColor: 'bg-gray-100' };
  }
};

// ステータスのテキストと色を取得
export const getStatusInfo = (status: 'not_started' | 'in_progress' | 'completed') => {
  switch (status) {
    case 'not_started':
      return { text: '未開始', color: 'text-gray-600', bgColor: 'bg-gray-100' };
    case 'in_progress':
      return { text: '進行中', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    case 'completed':
      return { text: '完了', color: 'text-green-600', bgColor: 'bg-green-100' };
    default:
      return { text: '不明', color: 'text-gray-600', bgColor: 'bg-gray-100' };
  }
};

// 完了率を計算
export const calculateCompletionRate = (completed: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
};

// 配列をシャッフル
export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// デバウンス関数
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// ISO文字列またはDateオブジェクトを作成
export const createTimestamp = (date?: Date): string => {
  return (date || new Date()).toISOString();
};

// 色のクラス名を取得（Tailwind CSS用）
export const getColorClasses = (color: string) => {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
    green: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
    red: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
    gray: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  };
  
  return colors[color] || colors.gray;
};