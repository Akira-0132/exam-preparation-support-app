'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5分間はデータが新鮮とみなす（ウィンドウ切替後の再取得を抑制）
        gcTime: 10 * 60 * 1000, // 10分間キャッシュを保持（長時間のタブ非アクティブ後もデータを保持）
        refetchOnWindowFocus: false, // フォーカス切替時のチラつき/再取得を抑制
        refetchOnMount: false, // マウント時に再取得しない（キャッシュ優先）
        refetchOnReconnect: true, // ネットワーク再接続時のみ再取得
        retry: 2, // 失敗時に2回リトライ
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // 指数バックオフ
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

