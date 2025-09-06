'use client';

import { useSidebar } from '@/lib/context/SidebarContext';

interface MainContentProps {
  children: React.ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  const { isSidebarOpen } = useSidebar();

  return (
    <main 
      className={`transition-all duration-300 ease-in-out ${
        isSidebarOpen 
          ? 'ml-80' // サイドバーが開いている時は左マージンを追加
          : 'ml-0'  // サイドバーが閉じている時は通常のマージン
      } w-full min-h-screen`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </main>
  );
}
