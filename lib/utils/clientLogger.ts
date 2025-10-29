export async function clientLog(message: string, data: any = null) {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, data }),
    });
  } catch {
    // ネットワークエラー時は黙殺（本番でのクラッシュを防ぐ）
  }
}
