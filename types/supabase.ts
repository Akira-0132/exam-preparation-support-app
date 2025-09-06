// Supabaseのデータベーススキーマに対応する型定義

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          role: 'student' | 'teacher';
          class_id: string | null;
          grade: number | null;
          student_number: string | null;
          managed_class_ids: string[] | null;
          subject: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          role: 'student' | 'teacher';
          class_id?: string | null;
          grade?: number | null;
          student_number?: string | null;
          managed_class_ids?: string[] | null;
          subject?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string;
          role?: 'student' | 'teacher';
          class_id?: string | null;
          grade?: number | null;
          student_number?: string | null;
          managed_class_ids?: string[] | null;
          subject?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      classes: {
        Row: {
          id: string;
          name: string;
          grade: number;
          teacher_id: string;
          student_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          grade: number;
          teacher_id: string;
          student_ids?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          grade?: number;
          teacher_id?: string;
          student_ids?: string[];
          created_at?: string;
        };
      };
      test_periods: {
        Row: {
          id: string;
          title: string;
          start_date: string;
          end_date: string;
          class_id: string;
          subjects: string[];
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          start_date: string;
          end_date: string;
          class_id: string;
          subjects: string[];
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          start_date?: string;
          end_date?: string;
          class_id?: string;
          subjects?: string[];
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          subject: string;
          priority: 'low' | 'medium' | 'high';
          status: 'not_started' | 'in_progress' | 'completed';
          due_date: string;
          estimated_time: number;
          actual_time: number | null;
          test_period_id: string;
          assigned_to: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
          cycle_number: number;
          learning_stage: 'overview' | 'review' | 'mastery' | 'perfect';
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          subject: string;
          priority: 'low' | 'medium' | 'high';
          status: 'not_started' | 'in_progress' | 'completed';
          due_date: string;
          estimated_time: number;
          actual_time?: number | null;
          test_period_id: string;
          assigned_to: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          cycle_number?: number;
          learning_stage?: 'overview' | 'review' | 'mastery' | 'perfect';
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          subject?: string;
          priority?: 'low' | 'medium' | 'high';
          status?: 'not_started' | 'in_progress' | 'completed';
          due_date?: string;
          estimated_time?: number;
          actual_time?: number | null;
          test_period_id?: string;
          assigned_to?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          cycle_number?: number;
          learning_stage?: 'overview' | 'review' | 'mastery' | 'perfect';
        };
      };
      task_relationships: {
        Row: {
          id: string;
          parent_task_id: string;
          child_task_id: string;
          cycle_number: number;
          page_number: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          parent_task_id: string;
          child_task_id: string;
          cycle_number: number;
          page_number?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          parent_task_id?: string;
          child_task_id?: string;
          cycle_number?: number;
          page_number?: number | null;
          created_at?: string;
        };
      };
      task_mistakes: {
        Row: {
          id: string;
          task_id: string;
          page_number: number;
          problem_numbers: number[];
          cycle_number: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          page_number: number;
          problem_numbers: number[];
          cycle_number: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          page_number?: number;
          problem_numbers?: number[];
          cycle_number?: number;
          created_at?: string;
        };
      };
      progress: {
        Row: {
          id: string;
          user_id: string;
          test_period_id: string;
          total_tasks: number;
          completed_tasks: number;
          total_estimated_time: number;
          total_actual_time: number;
          completion_rate: number;
          average_score: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          test_period_id: string;
          total_tasks?: number;
          completed_tasks?: number;
          total_estimated_time?: number;
          total_actual_time?: number;
          completion_rate?: number;
          average_score?: number | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          test_period_id?: string;
          total_tasks?: number;
          completed_tasks?: number;
          total_estimated_time?: number;
          total_actual_time?: number;
          completion_rate?: number;
          average_score?: number | null;
          updated_at?: string;
        };
      };
      schedules: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          tasks: any; // JSONB
          total_planned_time: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          tasks?: any;
          total_planned_time?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          tasks?: any;
          total_planned_time?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: 'task_reminder' | 'deadline_warning' | 'achievement' | 'system';
          title: string;
          message: string;
          is_read: boolean;
          related_task_id: string | null;
          related_test_period_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'task_reminder' | 'deadline_warning' | 'achievement' | 'system';
          title: string;
          message: string;
          is_read?: boolean;
          related_task_id?: string | null;
          related_test_period_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'task_reminder' | 'deadline_warning' | 'achievement' | 'system';
          title?: string;
          message?: string;
          is_read?: boolean;
          related_task_id?: string | null;
          related_test_period_id?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}