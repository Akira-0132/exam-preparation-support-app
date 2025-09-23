'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useDashboard } from '@/lib/context/DashboardContext';
import Select from '@/components/ui/Select';

export default function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { userProfile, logout } = useAuth();
  const { testPeriods, selectedTestPeriodId, onTestPeriodChange, currentTestPeriod } = useDashboard();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
      setIsOpen(false);
    } catch (error) {
      console.error('ログアウトエラー:', error);
      // セッションが既に失われている場合でも、ローカル状態をクリアしてログインページに移動
      router.push('/login');
      setIsOpen(false);
    }
  };

  const handleTestPeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onTestPeriodChange?.(e.target.value);
  };

  const handleCardClick = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  const handleSubjectClick = (subject: string) => {
    router.push(`/dashboard/subjects/${encodeURIComponent(subject)}`);
    setIsOpen(false);
  };

  const testPeriodOptions = testPeriods.map(period => {
    const start = new Date(period.startDate);
    const month = start.getMonth() + 1;
    const schoolYear = month <= 3 ? start.getFullYear() - 1 : start.getFullYear();
    let term: string;
    if (month >= 4 && month <= 7) term = '1学期';
    else if (month >= 9 && month <= 12) term = '2学期';
    else term = '3学期';
    const title = period.title || '';
    const hasTermInTitle = /(学期|前期|後期)/.test(title);
    return {
      value: period.id,
      label: `${schoolYear}年度 ${hasTermInTitle ? '' : term + ' '}${title}`.trim(),
    };
  });

  // 科目のリスト（実際の実装では、currentTestPeriodから取得）
  const subjects = currentTestPeriod?.subjects || ['英語', '数学', '理科', '国語', '社会'];

  return (
    <>
      {/* ハンバーガーメニューボタン */}
      <button
        onClick={() => setIsOpen(true)}
        className="sm:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200"
        aria-label="メニューを開く"
      >
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* サイドメニュー */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 sm:hidden ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* ヘッダー */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">クイックアクセス</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              aria-label="メニューを閉じる"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ユーザー情報 */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {userProfile?.displayName?.charAt(0) || 'U'}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900">{userProfile?.displayName || 'ユーザー'}</p>
                <p className="text-sm text-gray-500">{userProfile?.email}</p>
                <p className="text-xs text-blue-600">
                  {userProfile?.role === 'student' ? '生徒' : '教師'}
                </p>
              </div>
            </div>
            
            {/* テスト期間選択（生徒のみ） */}
            {userProfile?.role === 'student' && testPeriods.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  テスト期間
                </label>
                <Select
                  name="testPeriod"
                  value={selectedTestPeriodId || ''}
                  onChange={handleTestPeriodChange}
                  options={testPeriodOptions}
                  placeholder="テスト期間を選択"
                />
              </div>
            )}
          </div>

          {/* メニュー項目 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {/* ダッシュボード */}
              <button
                onClick={() => handleCardClick('/dashboard')}
                className="w-full flex items-center space-x-3 px-3 py-3 text-left hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span className="text-gray-900 font-medium">ダッシュボード</span>
              </button>

              {/* 科目別管理 */}
              <div>
                <button
                  onClick={() => handleCardClick(userProfile?.role === 'teacher' ? '/dashboard/teacher-subjects' : '/dashboard/subjects')}
                  className="w-full flex items-center space-x-3 px-3 py-3 text-left hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                  </svg>
                  <span className="text-gray-900 font-medium">科目別管理</span>
                </button>
                
                {/* 科目の常時表示（生徒のみ） */}
                {userProfile?.role !== 'teacher' && (
                  <div className="ml-8 mt-2 space-y-1">
                    {subjects.map((subject, index) => (
                      <button
                        key={index}
                        onClick={() => handleSubjectClick(subject)}
                        className="w-full flex items-center space-x-3 px-3 py-2 text左 hover:bg-gray-50 rounded-lg transition-colors text-sm"
                      >
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <span className="text-gray-700">{subject}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* タスク配布（教師のみ） */}
              {userProfile?.role === 'teacher' && (
                <button
                  onClick={() => handleCardClick('/dashboard/task-distribution-v2')}
                  className="w-full flex items-center space-x-3 px-3 py-3 text-left hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                  </svg>
                  <span className="text-gray-900 font-medium">タスク配布</span>
                </button>
              )}

              {/* テスト設定 */}
              <button
                onClick={() => handleCardClick('/dashboard/test-setup')}
                className="w-full flex items-center space-x-3 px-3 py-3 text-left hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.533 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-900 font-medium">テスト設定</span>
              </button>
            </div>
          </div>

          {/* ログアウトボタン */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-3 py-3 text-left hover:bg-red-50 rounded-lg transition-colors text-red-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="font-medium">ログアウト</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}