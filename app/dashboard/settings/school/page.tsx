'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { fetchSchoolsWithGrades, createSchool, createGrade, updateUserSchoolGrade, fetchUserSchoolGrade, searchSchools, createDebouncedSearch, SchoolSearchResult } from '@/lib/supabase/schools';
import { School, Grade } from '@/types';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

export default function SchoolSettingsPage() {
  const router = useRouter();
  const { userProfile, currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // 学校・学年データ
  const [schools, setSchools] = useState<(School & { grades: Grade[] })[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [availableGrades, setAvailableGrades] = useState<Grade[]>([]);
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);
  const [currentGrade, setCurrentGrade] = useState<Grade | null>(null);

  // 新規学校作成フォーム
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolPrefecture, setNewSchoolPrefecture] = useState('');
  const [newSchoolCity, setNewSchoolCity] = useState('');
  const [showNewSchoolForm, setShowNewSchoolForm] = useState(false);
  const [creatingSchool, setCreatingSchool] = useState(false);
  
  // 学校検索用の状態
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SchoolSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // デバウンス付き検索
  const debouncedSearch = createDebouncedSearch(300);
  
  // 学校検索ハンドラー
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      setIsSearching(true);
      debouncedSearch(query, (results) => {
        setSearchResults(results);
        setIsSearching(false);
        setShowSearchResults(true);
      });
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };
  
  // 検索結果から学校を選択
  const handleSchoolSelect = async (school: SchoolSearchResult) => {
    setSearchQuery(school.name);
    setShowSearchResults(false);
    
    // 既存の学校リストに追加
    try {
      const schoolId = await createSchool(school.name, school.prefecture, school.city);
      setSelectedSchoolId(schoolId);
      
      // 学校リストを再読み込み
      const updatedSchools = await fetchSchoolsWithGrades();
      setSchools(updatedSchools);
      
      // デフォルト学年を作成
      const gradeId = await createGrade(schoolId, 1, '1年生');
      setSelectedGradeId(gradeId);
      
      // 利用可能な学年を更新
      const grades = updatedSchools.find(s => s.id === schoolId)?.grades || [];
      setAvailableGrades(grades);
    } catch (error) {
      console.error('学校作成エラー:', error);
      setError('学校の作成に失敗しました');
    }
  };

  // データ読み込み
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return;

      setLoading(true);
      setError('');

      try {
        // 学校・学年一覧を取得
        const schoolsData = await fetchSchoolsWithGrades();
        setSchools(schoolsData);

        // 現在のユーザーの学校・学年情報を取得
        const userSchoolGrade = await fetchUserSchoolGrade(currentUser.id);
        setCurrentSchool(userSchoolGrade.school);
        setCurrentGrade(userSchoolGrade.grade);

        if (userSchoolGrade.school) {
          setSelectedSchoolId(userSchoolGrade.school.id);
          const school = schoolsData.find(s => s.id === userSchoolGrade.school!.id);
          if (school) {
            setAvailableGrades(school.grades);
            if (userSchoolGrade.grade) {
              setSelectedGradeId(userSchoolGrade.grade.id);
            }
          }
        } else {
          // デフォルトで「個人クラス」を選択
          const personalClass = schoolsData.find(s => s.name === '個人クラス');
          if (personalClass) {
            setSelectedSchoolId(personalClass.id);
            setAvailableGrades(personalClass.grades);
            if (personalClass.grades.length > 0) {
              setSelectedGradeId(personalClass.grades[0].id);
            }
          }
        }

      } catch (error) {
        console.error('データの読み込みに失敗:', error);
        setError('データの読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  // 学校選択時の学年更新
  useEffect(() => {
    if (selectedSchoolId) {
      const selectedSchool = schools.find(s => s.id === selectedSchoolId);
      if (selectedSchool) {
        setAvailableGrades(selectedSchool.grades);
        // 現在選択されている学年が新しい学校にない場合はリセット
        if (!selectedSchool.grades.find(g => g.id === selectedGradeId)) {
          setSelectedGradeId('');
        }
      }
    }
  }, [selectedSchoolId, schools, selectedGradeId]);

  // 学校・学年設定の保存
  const handleSave = async () => {
    if (!currentUser || !selectedSchoolId || !selectedGradeId) {
      setError('学校と学年を選択してください');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await updateUserSchoolGrade(currentUser.id, selectedSchoolId, selectedGradeId);
      
      // 現在の設定を更新
      const selectedSchool = schools.find(s => s.id === selectedSchoolId);
      const selectedGrade = availableGrades.find(g => g.id === selectedGradeId);
      
      setCurrentSchool(selectedSchool || null);
      setCurrentGrade(selectedGrade || null);
      
      setSuccess('学校・学年の設定を保存しました');
      
      // 3秒後に成功メッセージを消す
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('設定の保存に失敗:', error);
      setError(error instanceof Error ? error.message : '設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // 新規学校作成
  const handleCreateSchool = async () => {
    if (!newSchoolName.trim()) {
      setError('学校名を入力してください');
      return;
    }

    setCreatingSchool(true);
    setError('');

    try {
      const schoolId = await createSchool(
        newSchoolName.trim(), 
        newSchoolPrefecture.trim() || undefined, 
        newSchoolCity.trim() || undefined
      );
      
      // 1-3年生の学年を自動作成
      const gradePromises = [1, 2, 3].map(gradeNumber => 
        createGrade(schoolId, gradeNumber, `${gradeNumber}年生`)
      );
      await Promise.all(gradePromises);

      // 学校一覧を再読み込み
      const updatedSchools = await fetchSchoolsWithGrades();
      setSchools(updatedSchools);

      // 新しく作成した学校を選択
      setSelectedSchoolId(schoolId);
      const newSchool = updatedSchools.find(s => s.id === schoolId);
      if (newSchool) {
        setAvailableGrades(newSchool.grades);
        if (newSchool.grades.length > 0) {
          setSelectedGradeId(newSchool.grades[0].id);
        }
      }

      // フォームをリセット
      setNewSchoolName('');
      setNewSchoolPrefecture('');
      setNewSchoolCity('');
      setShowNewSchoolForm(false);

      setSuccess('学校を作成しました');

    } catch (error) {
      setError(error instanceof Error ? error.message : '学校の作成に失敗しました');
    } finally {
      setCreatingSchool(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">学校・学年設定</h1>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          ダッシュボードに戻る
        </Button>
      </div>

      {/* 現在の設定表示 */}
      {currentSchool && currentGrade && (
        <Card>
          <CardHeader>
            <CardTitle className="text-gray-900">現在の設定</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium text-blue-900">
                  {currentSchool.name} - {currentGrade.name}
                </span>
              </div>
              {currentSchool.prefecture && (
                <p className="text-sm text-blue-700 mt-1">
                  {currentSchool.prefecture} {currentSchool.city}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 学校・学年選択フォーム */}
      <Card>
        <CardHeader>
          <CardTitle className="text-gray-900">学校・学年を選択</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 学校選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">学校</label>
            <div className="flex gap-2">
              <select 
                className="border rounded px-3 py-2 flex-1 text-gray-900" 
                value={selectedSchoolId} 
                onChange={e => setSelectedSchoolId(e.target.value)}
              >
                <option value="">学校を選択してください</option>
                {schools.map(school => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                    {school.prefecture && ` (${school.prefecture}${school.city ? school.city : ''})`}
                  </option>
                ))}
              </select>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowNewSchoolForm(!showNewSchoolForm)}
              >
                新規作成
              </Button>
            </div>
          </div>

          {/* 学年選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">学年</label>
            <select 
              className="border rounded px-3 py-2 w-full text-gray-900" 
              value={selectedGradeId} 
              onChange={e => setSelectedGradeId(e.target.value)}
              disabled={!selectedSchoolId}
            >
              <option value="">学年を選択してください</option>
              {availableGrades.map(grade => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </div>

          {/* 新規学校作成フォーム */}
          {showNewSchoolForm && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-gray-900">新規学校作成</h3>
              
              {/* 学校検索機能 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900">
                  学校名を検索（推奨）
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2 pr-8 text-gray-900"
                    placeholder="学校名を入力してください（2文字以上）"
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                  />
                  {isSearching && (
                    <div className="absolute right-2 top-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>
                
                {/* 検索結果表示 */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="border rounded bg-white max-h-48 overflow-y-auto">
                    {searchResults.map((school, index) => (
                      <div
                        key={index}
                        className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                        onClick={() => handleSchoolSelect(school)}
                      >
                        <div className="font-medium text-gray-900">{school.name}</div>
                        <div className="text-sm text-gray-700">
                          {school.prefecture} {school.city}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {showSearchResults && searchResults.length === 0 && !isSearching && (
                  <div className="text-sm text-gray-600 p-2">
                    該当する学校が見つかりませんでした。<br />
                    手動で学校名を入力してください。
                  </div>
                )}
              </div>
              
              <div className="text-center text-gray-500 text-sm">または</div>
              
              {/* 手動入力フォーム */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  className="border rounded px-3 py-2 text-gray-900"
                  placeholder="学校名（必須）"
                  value={newSchoolName}
                  onChange={e => setNewSchoolName(e.target.value)}
                />
                <input
                  type="text"
                  className="border rounded px-3 py-2 text-gray-900"
                  placeholder="都道府県（任意）"
                  value={newSchoolPrefecture}
                  onChange={e => setNewSchoolPrefecture(e.target.value)}
                />
                <input
                  type="text"
                  className="border rounded px-3 py-2 text-gray-900"
                  placeholder="市区町村（任意）"
                  value={newSchoolCity}
                  onChange={e => setNewSchoolCity(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  loading={creatingSchool}
                  onClick={handleCreateSchool}
                >
                  学校を作成
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setShowNewSchoolForm(false);
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          )}

          {/* エラー・成功メッセージ */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {/* 保存ボタン */}
          <div className="flex justify-end">
            <Button 
              loading={saving}
              onClick={handleSave}
              disabled={!selectedSchoolId || !selectedGradeId}
            >
              設定を保存
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 説明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-gray-900">設定について</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 space-y-2">
            <p>• 学校・学年を設定することで、同じ学校・学年の先生が作成したテスト期間やタスクを利用できます</p>
            <p>• 先生が新しいタスクを作成すると、同じ学校・学年の生徒に自動で共有されます</p>
            <p>• 個人クラスを選択した場合は、従来通り個人用のテスト期間を作成できます</p>
            <p>• 設定はいつでも変更可能です</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
