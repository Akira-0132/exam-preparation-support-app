'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useSidebar } from '@/lib/context/SidebarContext';
import { TestPeriod } from '@/types';
import Select from '@/components/ui/Select';

interface HeaderProps {
  testPeriods?: TestPeriod[];
  selectedTestPeriod?: string;
  onTestPeriodChange?: (testPeriodId: string) => void;
  isLoading?: boolean;
}

export default function Header({ 
  testPeriods = [], 
  selectedTestPeriod = '', 
  onTestPeriodChange,
  isLoading = false,
}: HeaderProps) {
  const router = useRouter();
  const { userProfile, logout } = useAuth();
  const { isSidebarOpen } = useSidebar();
  const [showMenu, setShowMenu] = useState(false);

  const handleTestPeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onTestPeriodChange?.(e.target.value);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  if (isLoading) {
    return (
      <header className="bg-white shadow-sm border-b">
        <div className={`transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'ml-80 w-[calc(100%-20rem)]' : 'ml-0 w-full'
        }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-16 flex items-center justify-between">
              <div className="animate-pulse bg-gray-200 h-6 w-48 rounded"></div>
              <div className="animate-pulse bg-gray-200 h-8 w-24 rounded"></div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  const testPeriodOptions = testPeriods.map(period => {
    const start = new Date(period.startDate);
    const month = start.getMonth() + 1; // 1-12
    const schoolYear = month <= 3 ? start.getFullYear() - 1 : start.getFullYear();
    let term: string;
    if (month >= 4 && month <= 7) term = '1学期';
    else if (month >= 9 && month <= 12) term = '2学期';
    else term = '3学期'; // 1-3月
    return {
      value: period.id,
      label: `${schoolYear}年度 ${term} ${period.title}`,
    };
  });

  // 選択中のテスト期間の情報を取得
  const currentTestPeriod = testPeriods.find(period => period.id === selectedTestPeriod);
  
  // テスト開始日までの残り日数を計算
  const getDaysUntilTest = () => {
    if (!currentTestPeriod?.startDate) return null;
    const today = new Date();
    const testStartDate = new Date(currentTestPeriod.startDate);
    const diffTime = testStartDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilTest = getDaysUntilTest();

  return (
    <header className="bg-white shadow-sm border-b">
      <div className={`transition-all duration-300 ease-in-out ${
        isSidebarOpen ? 'ml-80 w-[calc(100%-20rem)]' : 'ml-0 w-full'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
          {/* 左側: ロゴ・アプリ名 */}
          <div className="flex items-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-xl font-bold text-blue-600 hover:text-blue-800 transition-colors"
            >
              定期試験対策アプリ
            </button>
          </div>
          
          {/* 中央: テスト期間切り替え（生徒のみ） */}
          <div className="flex items-center justify-center">
            {userProfile?.role === 'student' && testPeriods.length > 0 && (
              <div className="hidden sm:flex items-center space-x-4">
                <Select
                  name="testPeriod"
                  value={selectedTestPeriod}
                  onChange={handleTestPeriodChange}
                  options={testPeriodOptions}
                  placeholder="テスト期間を選択"
                />
                
                {/* テスト開始日表示 */}
                {currentTestPeriod && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">テスト開始:</span>
                    <span className="ml-1">
                      {new Date(currentTestPeriod.startDate).toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    {daysUntilTest !== null && (
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                        daysUntilTest <= 0 
                          ? 'bg-red-100 text-red-800' 
                          : daysUntilTest <= 7 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                      }`}>
                        {daysUntilTest <= 0 ? 'テスト中' : `あと${daysUntilTest}日`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 右側: ユーザー情報・メニュー */}
          <div className="flex items-center space-x-4">
            {/* モバイル用テスト期間切り替え - ハンバーガーメニューに移動 */}

            {/* ユーザー情報 - デスクトップのみ表示 */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600">
                    {userProfile?.displayName?.charAt(0) || userProfile?.email?.charAt(0) || 'U'}
                  </span>
                </div>
                <span className="text-sm font-medium">
                  {userProfile?.displayName || userProfile?.email || 'ユーザー'}
                </span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* ドロップダウンメニュー */}
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b">
                    <div className="font-medium">{userProfile?.displayName}</div>
                    <div className="text-gray-500">{userProfile?.email}</div>
                    <div className="text-gray-500">
                      {userProfile?.role === 'student' ? '生徒' : '講師'}
                    </div>
                  </div>
                  
                  {userProfile?.role === 'student' && (
                    <button
                      onClick={() => {
                        router.push('/dashboard/test-setup');
                        setShowMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      テスト設定
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      handleLogout();
                      setShowMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* クリック外しでメニューを閉じる */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        ></div>
      )}
    </header>
  );
}
