// Supabase用の型定義 (ISO文字列を使用)

// ユーザー関連の型定義
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'student' | 'teacher';
  classId?: string; // 生徒の場合、所属クラスID
  createdAt: string;
  updatedAt: string;
}

// 生徒プロファイル（User拡張）
export interface StudentProfile extends User {
  role: 'student';
  classId: string;
  grade: number;
  studentNumber: string;
}

// 講師プロファイル（User拡張）
export interface TeacherProfile extends User {
  role: 'teacher';
  managedClassIds: string[]; // 管理するクラスIDの配列
  subject: string; // 担当科目
}

// クラス情報
export interface Class {
  id: string;
  name: string; // 例: "3年A組"
  grade: number;
  teacherId: string;
  studentIds: string[];
  createdAt: string;
}

// テスト期間
export interface TestPeriod {
  id: string;
  title: string; // 例: "第1回定期試験"
  startDate: string;
  endDate: string;
  classId: string;
  subjects: string[]; // 試験科目
  createdBy: string; // 作成者（講師）のID
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
  mode?: 'solo' | 'managed';
  visibility?: 'private' | 'public';
}

// 課題・タスク
export interface Task {
  id: string;
  title: string;
  description: string;
  subject: string; // 科目
  priority: 'low' | 'medium' | 'high';
  status: 'not_started' | 'in_progress' | 'completed';
  dueDate: string;
  estimatedTime: number; // 見積もり時間（分）
  actualTime?: number; // 実際にかかった時間（分）
  testPeriodId: string; // 関連するテスト期間
  assignedTo: string; // 担当者（生徒）のID
  createdBy: string; // 作成者のID
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  // 階層構造サポート
  parentTaskId?: string; // 親タスクのID
  taskType: 'single' | 'parent' | 'subtask'; // タスクの種類
  totalUnits?: number; // 総量（ページ数、問題数など）
  completedUnits?: number; // 完了した量
  unitType?: 'pages' | 'problems' | 'hours' | 'sections'; // 単位の種類
  // 周回学習サポート
  cycleNumber?: number; // 何周目か（デフォルト: 1）
  learningStage?: 'overview' | 'review' | 'mastery' | 'perfect'; // 学習段階
}

// 進捗データ
export interface Progress {
  id: string;
  userId: string; // 生徒のID
  testPeriodId: string;
  totalTasks: number;
  completedTasks: number;
  totalEstimatedTime: number;
  totalActualTime: number;
  completionRate: number; // 完了率（0-100）
  averageScore?: number; // 平均点（テスト結果から計算）
  updatedAt: string;
}

// スケジュール
export interface Schedule {
  id: string;
  userId: string;
  date: string;
  tasks: {
    taskId: string;
    plannedTime: number; // 予定時間（分）
    startTime?: string; // HH:MM形式
    endTime?: string; // HH:MM形式
  }[];
  totalPlannedTime: number;
  createdAt: string;
  updatedAt: string;
}

// 通知
export interface Notification {
  id: string;
  userId: string; // 受信者のID
  type: 'task_reminder' | 'deadline_warning' | 'achievement' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedTaskId?: string;
  relatedTestPeriodId?: string;
}

// API レスポンス型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// フォーム関連の型
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  role: 'student' | 'teacher';
  grade?: number;
  studentNumber?: string;
  classId?: string;
  subject?: string;
}

export interface TaskForm {
  title: string;
  description: string;
  subject: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string; // ISO date string
  estimatedTime: number;
  testPeriodId: string;
  // 分割設定
  isSplitTask?: boolean; // 分割タスクかどうか
  totalUnits?: number; // 総量
  unitType?: 'pages' | 'problems' | 'hours' | 'sections'; // 単位
  dailyUnits?: number; // 1日あたりの量
}

export interface TestPeriodForm {
  title: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  subjects: string[];
  classId: string;
}

// ダッシュボード表示用の型
export interface DashboardData {
  user: User;
  upcomingTasks: Task[];
  progress: Progress;
  recentNotifications: Notification[];
  todaySchedule: Schedule | null;
}

// 統計データ
export interface Statistics {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  averageTimePerTask: number;
  productivityScore: number;
  weeklyProgress: {
    date: string;
    completed: number;
    total: number;
  }[];
}