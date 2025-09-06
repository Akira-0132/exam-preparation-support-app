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
          ? 'ml-80 w-[calc(100%-20rem)]' // サイドバーが開いている時は左マージンを追加し、幅を調整
          : 'ml-0 w-full'  // サイドバーが閉じている時は通常のマージンと幅
      } min-h-screen`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </main>
  );
}
