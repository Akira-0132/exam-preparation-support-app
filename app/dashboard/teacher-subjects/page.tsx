'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { fetchSchoolsWithGrades } from '@/lib/supabase/schools';
import { getTestPeriodsByTeacherId } from '@/lib/supabase/test-periods';
import type { Grade, School, TestPeriod } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function TeacherSubjectsIndexPage() {
  const router = useRouter();
  const { currentUser, userProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<(School & { grades: Grade[] })[]>([]);
  const [teacherPeriods, setTeacherPeriods] = useState<TestPeriod[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!currentUser || userProfile?.role !== 'teacher') {
        setLoading(false);
        return;
      }
      try {
        const [schoolsRes, periodsRes] = await Promise.all([
          fetchSchoolsWithGrades(),
          getTestPeriodsByTeacherId(currentUser.id),
        ]);
        setSchools(schoolsRes);
        setTeacherPeriods(periodsRes);
      } catch (e) {
        console.error('データの取得に失敗:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentUser, userProfile]);

  const schoolIdToGrades = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of schools) {
      map.set(s.id, s.grades.map(g => g.id));
    }
    return map;
  }, [schools]);

  const visibleGrades = useMemo(() => {
    if (!selectedSchoolId) return [] as Grade[];
    const school = schools.find(s => s.id === selectedSchoolId);
    return school ? school.grades : [];
  }, [selectedSchoolId, schools]);

  const visiblePeriods = useMemo(() => {
    if (!selectedGradeId) return [] as TestPeriod[];
    return teacherPeriods.filter(p => p.classId === selectedGradeId);
  }, [selectedGradeId, teacherPeriods]);

  if (userProfile?.role !== 'teacher') {
    return (
      <Card variant="elevated">
        <CardContent className="text-center py-12">
          <h2 className="text-lg font-semibold text-gray-800">アクセス権限がありません</h2>
          <p className="text-gray-500 mt-2">このページは先生のみアクセスできます。</p>
          <Button className="mt-4" onClick={() => router.push('/dashboard')}>ダッシュボードに戻る</Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} variant="outlined">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">科目別学習管理（学校 → テスト期間 選択）</h1>
          <p className="text-gray-600 mt-1">学校を選択し、作成済みのテスト期間を選んでください</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>ダッシュボード</Button>
      </div>

      {/* 学校一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>学校を選択</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schools.map((school) => (
              <Card
                key={school.id}
                variant={selectedSchoolId === school.id ? 'elevated' : 'outlined'}
                className="cursor-pointer hover:shadow-md"
                onClick={() => {
                  setSelectedSchoolId(school.id);
                  setSelectedGradeId(null);
                }}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{school.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">学年: {school.grades.map(g => g.name).join(' / ')}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 学年一覧（学校選択後） */}
      {selectedSchoolId && (
        <Card>
          <CardHeader>
            <CardTitle>学年を選択</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleGrades.map((grade) => (
                <Card
                  key={grade.id}
                  variant={selectedGradeId === grade.id ? 'elevated' : 'outlined'}
                  className="cursor-pointer hover:shadow-md"
                  onClick={() => setSelectedGradeId(grade.id)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{grade.name}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* テスト期間一覧（学年選択後） */}
      {selectedGradeId && (
        <Card>
          <CardHeader>
            <CardTitle>テスト期間を選択</CardTitle>
          </CardHeader>
          <CardContent>
            {visiblePeriods.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visiblePeriods.map((period) => (
                  <Card
                    key={period.id}
                    variant="outlined"
                    className="cursor-pointer hover:shadow-md"
                    onClick={() => router.push(`/dashboard/subjects?period=${period.id}`)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{period.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>{new Date(period.startDate).toLocaleDateString('ja-JP')} ～ {new Date(period.endDate).toLocaleDateString('ja-JP')}</p>
                        <p>
                          学校: {schools.find(s => s.id === selectedSchoolId)?.name || '-'}
                          <span className="mx-2">|</span>
                          学年: {visibleGrades.find(g => g.id === period.classId)?.name || '-'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-600">この学校に紐づく作成済みのテスト期間がありません</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


