'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TaskDistributionPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/task-distribution-v2');
  }, [router]);

  return (
    <div className="py-12 text-center text-gray-700">
      新しいタスク配布ページにリダイレクトしています…
    </div>
  );
}


