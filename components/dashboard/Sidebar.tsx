'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useSidebar } from '@/lib/context/SidebarContext';
import { useDashboard } from '@/lib/context/DashboardContext';

export default function Sidebar() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { isSidebarOpen: isOpen, toggleSidebar, closeSidebar } = useSidebar();
  const { currentTestPeriod } = useDashboard();

  const handleCardClick = (path: string) => {
    router.push(path);
    closeSidebar();
  };

  const handleSubjectClick = (subject: string) => {
    router.push(`/dashboard/subjects/${encodeURIComponent(subject)}`);
    closeSidebar();
  };

  // 科目のリスト（実際の実装では、currentTestPeriodから取得）
  const subjects = currentTestPeriod?.subjects || ['英語', '数学', '理科', '国語', '社会'];

  return (
    <>
      {/* サイドバートグルボタン - デスクトップのみ表示 */}
      <button
        onClick={toggleSidebar}
        className="hidden sm:block fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        style={{ marginLeft: isOpen ? '320px' : '0px' }}
        aria-label="サイドバーを開く"
      >
        <svg 
          className={`w-6 h-6 text-gray-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* オーバーレイは削除 - PC画面ではメインコンテンツを操作可能にする */}

      {/* サイドバー - デスクトップのみ表示 */}
      <div className={`hidden sm:block fixed top-0 left-0 h-full w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* ヘッダー */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">クイックアクセス</h2>
            <button
              onClick={closeSidebar}
              className="p-2 hover:bg-gray-100 rounded-lg"
              aria-label="サイドバーを閉じる"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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
                  onClick={() => handleCardClick('/dashboard/subjects')}
                  className="w-full flex items-center space-x-3 px-3 py-3 text-left hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                  </svg>
                  <span className="text-gray-900 font-medium">科目別管理</span>
                </button>
                
                {/* 科目の常時表示 */}
                <div className="ml-8 mt-2 space-y-1">
                  {subjects.map((subject, index) => (
                    <button
                      key={index}
                      onClick={() => handleSubjectClick(subject)}
                      className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-50 rounded-lg transition-colors text-sm"
                    >
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span className="text-gray-700">{subject}</span>
                    </button>
                  ))}
                </div>
              </div>

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

              {/* クラス管理（教師のみ） */}
              {userProfile?.role === 'teacher' && (
                <button
                  onClick={() => handleCardClick('/dashboard/test-setup/classes')}
                  className="w-full flex items-center space-x-3 px-3 py-3 text-left hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a1 1 0 01.894.553l1.382 2.763 3.05.443a1 1 0 01.554 1.706l-2.206 2.15.521 3.036a1 1 0 01-1.451 1.054L10 12.347l-2.744 1.44a1 1 0 01-1.451-1.054l.521-3.036-2.206-2.15a1 1 0 01.554-1.706l3.05-.443 1.382-2.763A1 1 0 0110 2z" />
                  </svg>
                  <span className="text-gray-900 font-medium">クラス管理</span>
                </button>
              )}

              {/* 学校設定（生徒のみ） */}
              {userProfile?.role === 'student' && (
                <button
                  onClick={() => handleCardClick('/dashboard/settings/school')}
                  className="w-full flex items-center space-x-3 px-3 py-3 text-left hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 114 0 2 2 0 01-4 0zm6 0a2 2 0 114 0 2 2 0 01-4 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-900 font-medium">学校設定</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}