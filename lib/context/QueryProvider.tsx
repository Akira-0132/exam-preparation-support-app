'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1分間はデータが新鮮とみなす
        gcTime: 5 * 60 * 1000, // 5分間キャッシュを保持 (v5では cacheTime → gcTime)
        refetchOnWindowFocus: true, // ウィンドウフォーカス時に再取得
        refetchOnMount: true, // マウント時に再取得
        retry: 1, // 失敗時に1回リトライ
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

