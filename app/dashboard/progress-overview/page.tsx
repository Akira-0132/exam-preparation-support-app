'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { getTaskStatisticsForTeacher } from '@/lib/supabase/tasks';
import type { User, Grade, School } from '@/types';
import { fetchSchoolsWithGrades } from '@/lib/supabase/schools';
import { getStudentsByGrade } from '@/lib/supabase/tasks';
import { sendStamp } from '@/lib/supabase/encouragements';

interface StudentProgress {
  id: string;
  displayName: string;
  avatarUrl?: string;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
}

const STAMP_PRESETS = [
  'この調子！',
  'よく頑張った！',
  '無理しすぎないでね',
  '質問があればいつでも',
  'あと少しで目標達成！',
];

export default function ProgressOverviewPage() {
  const router = useRouter();
  const { userProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<(School & { grades: Grade[] })[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [studentsProgress, setStudentsProgress] = useState<StudentProgress[]>([]);
  const [sendingStudentId, setSendingStudentId] = useState<string | null>(null);
  const [lastSentStudentId, setLastSentStudentId] = useState<string | null>(null);

  const visibleGrades = useMemo(() => {
    if (!selectedSchoolId) return [] as Grade[];
    const s = schools.find(x => x.id === selectedSchoolId);
    return s ? s.grades : [];
  }, [selectedSchoolId, schools]);

  const loadSchools = useCallback(async () => {
    try {
      const data = await fetchSchoolsWithGrades();
      setSchools(data);
      // 既定値（前回選択を使う or 先頭）
      const lastSchool = typeof window !== 'undefined' ? localStorage.getItem('teacher.selectedSchoolId') : null;
      const lastGrade = typeof window !== 'undefined' ? localStorage.getItem('teacher.selectedGradeId') : null;
      const defaultSchool = lastSchool && data.some(s => s.id === lastSchool) ? lastSchool : (data[0]?.id ?? null);
      setSelectedSchoolId(defaultSchool);
      const defaultGrade = lastGrade && data.some(s => s.grades.some(g => g.id === lastGrade))
        ? lastGrade
        : (data[0]?.grades?.[0]?.id ?? null);
      setSelectedGradeId(defaultGrade);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStudentsProgress = useCallback(async (gradeId: string | null) => {
    if (!gradeId) {
      setStudentsProgress([]);
      return;
    }
    setLoading(true);
    try {
      const students = await getStudentsByGrade(gradeId);
      const progressData = await Promise.all(
        students.map(async (student) => {
          const stats = await getTaskStatisticsForTeacher(student.id);
          return {
            id: student.id,
            displayName: student.displayName,
            completionRate: stats.completionRate,
            totalTasks: stats.total,
            completedTasks: stats.completed,
          } as StudentProgress;
        })
      );
      setStudentsProgress(progressData);
    } catch (e) {
      console.error('Failed to load students progress by grade', e);
      setStudentsProgress([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSendStamp = useCallback(async (studentId: string, message: string) => {
    if (!userProfile?.id) return;
    try {
      setSendingStudentId(studentId);
      await sendStamp(userProfile.id, studentId, 'preset', message);
      setLastSentStudentId(studentId);
      setTimeout(() => setLastSentStudentId(null), 1500);
    } catch (e) {
      console.error('Failed to send stamp', e);
    } finally {
      setSendingStudentId(null);
    }
  }, [userProfile]);

  useEffect(() => {
    if (userProfile?.role !== 'teacher') {
      router.push('/dashboard');
      return;
    }
    loadSchools();
  }, [userProfile, router, loadSchools]);

  useEffect(() => {
    if (!selectedGradeId) return;
    // 選択を保持
    if (typeof window !== 'undefined') {
      if (selectedSchoolId) localStorage.setItem('teacher.selectedSchoolId', selectedSchoolId);
      localStorage.setItem('teacher.selectedGradeId', selectedGradeId);
    }
    loadStudentsProgress(selectedGradeId);
  }, [selectedGradeId, selectedSchoolId, loadStudentsProgress]);

  if (loading) {
    return <div>読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">生徒の進捗一覧</h1>
          <p className="text-gray-600 mt-1">学校と学年を選択して、対象生徒の進捗を確認できます。</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedSchoolId ?? ''}
            onChange={(e) => setSelectedSchoolId(e.target.value || null)}
            className="border rounded px-3 py-2"
          >
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={selectedGradeId ?? ''}
            onChange={(e) => setSelectedGradeId(e.target.value || null)}
            className="border rounded px-3 py-2"
          >
            {visibleGrades.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>学年の生徒</CardTitle>
        </CardHeader>
        <CardContent>
          {studentsProgress.length === 0 ? (
            <div className="text-gray-600">生徒が見つかりません。</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {studentsProgress.map((student) => (
                <Card key={student.id} variant="outlined">
                  <CardHeader>
                    <CardTitle>{student.displayName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <p>完了率: {student.completionRate}%</p>
                      <p>タスク: {student.completedTasks} / {student.totalTasks}</p>
                    </div>

                    <div className="pt-2">
                      <div className="text-sm text-gray-600 mb-1">応援スタンプを送る</div>
                      <div className="flex flex-wrap gap-2">
                        {STAMP_PRESETS.map((label) => (
                          <Button
                            key={label}
                            size="sm"
                            variant="outline"
                            disabled={sendingStudentId === student.id}
                            onClick={() => handleSendStamp(student.id, label)}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                      {lastSentStudentId === student.id && (
                        <div className="text-green-600 text-xs mt-2">送信しました</div>
                      )}
                    </div>

                    <div className="pt-2 flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/subjects?student=${student.id}`)}>詳細を見る</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
