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
  const { testPeriods, selectedTestPeriodId, onTestPeriodChange } = useDashboard();

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

  const testPeriodOptions = testPeriods.map(period => ({
    value: period.id,
    label: period.title
  }));

  const menuItems = [
    {
      label: 'ホーム',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      ),
      onClick: () => {
        router.push('/dashboard');
        setIsOpen(false);
      }
    },
    {
      label: 'タスク',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      ),
      onClick: () => {
        router.push('/dashboard/tasks');
        setIsOpen(false);
      }
    },
    {
      label: '進捗',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
      ),
      onClick: () => {
        router.push('/dashboard/progress');
        setIsOpen(false);
      }
    },
    {
      label: '科目別管理',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => {
        router.push('/dashboard/subjects');
        setIsOpen(false);
      }
    },
    {
      label: 'テスト設定',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      ),
      onClick: () => {
        router.push('/dashboard/test-setup');
        setIsOpen(false);
      }
    }
  ];

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
            <h2 className="text-lg font-semibold text-gray-900">メニュー</h2>
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

          {/* メニューアイテム */}
          <div className="flex-1 overflow-y-auto">
            <nav className="p-4">
              <ul className="space-y-2">
                {menuItems.map((item, index) => (
                  <li key={index}>
                    <button
                      onClick={item.onClick}
                      className="w-full flex items-center space-x-3 px-3 py-3 text-left hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <span className="text-gray-600">{item.icon}</span>
                      <span className="text-gray-900 font-medium">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
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
