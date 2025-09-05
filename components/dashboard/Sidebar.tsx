'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useSidebar } from '@/lib/context/SidebarContext';
import { Card, CardContent } from '@/components/ui/Card';

export default function Sidebar() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { isSidebarOpen: isOpen, toggleSidebar, closeSidebar } = useSidebar();

  const handleCardClick = (path: string) => {
    router.push(path);
    closeSidebar();
  };

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

          {/* カード一覧 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* 科目別管理カード */}
              <Card 
                variant="outlined" 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleCardClick('/dashboard/subjects')}
              >
                <CardContent className="text-center p-6">
                  <div className="w-12 h-12 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">科目別管理</h3>
                  <p className="text-sm text-gray-600">科目ごとにタスクを管理</p>
                </CardContent>
              </Card>

              {/* テスト設定カード */}
              <Card 
                variant="outlined" 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleCardClick('/dashboard/test-setup')}
              >
                <CardContent className="text-center p-6">
                  <div className="w-12 h-12 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">テスト設定</h3>
                  <p className="text-sm text-gray-600">テスト期間の設定・変更</p>
                </CardContent>
              </Card>

              {/* 追加のクイックアクセス項目 */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">その他の機能</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => handleCardClick('/dashboard/tasks')}
                    className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-900 font-medium">タスク一覧</span>
                  </button>
                  
                  <button
                    onClick={() => handleCardClick('/dashboard/progress')}
                    className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    <span className="text-gray-900 font-medium">進捗管理</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
