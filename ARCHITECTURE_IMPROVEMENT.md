# Next.js + Supabase パフォーマンス改善計画

## 現状の問題点

### 1. データ取得のタイミング問題
- **認証 → プロフィール取得 → データ取得** が順次実行される
- 各ステップで遅延が累積（合計2-3秒）
- ネットワーク遅延が増幅される

### 2. クライアントサイドのRLS問題
- Row Level Security (RLS) のチェックがクライアントで実行される
- ネットワークラウンドトリップが多い
- 認証トークンの検証に時間がかかる

### 3. React Stateの更新タイミング
- 非同期の状態更新が複数回発生
- リレンダリングが頻繁に起きる
- UIの「ちらつき」や空白表示

---

## 推奨される改善策

### ✅ 短期的な改善（1-2日で実装可能）

#### 1. データ取得の並列化
```typescript
// ❌ 現在: 順次実行
const profile = await fetchUserProfile(user);
const periods = await getTestPeriodsByClassId(profile.gradeId);
const tasks = await getTasksByPeriod(periods[0].id);

// ✅ 改善: 並列実行
const [profile, periods] = await Promise.all([
  fetchUserProfile(user),
  getTestPeriodsForUser(user.id) // user.idから直接取得
]);
```

#### 2. Supabase Realtimeの活用
```typescript
// リアルタイム更新を設定（すでに一部実装済み）
useEffect(() => {
  const channel = supabase
    .channel('tasks-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'tasks' },
      () => refreshData()
    )
    .subscribe();
  
  return () => { channel.unsubscribe(); };
}, []);
```

#### 3. Optimistic UI Updates
```typescript
// タスク完了時に即座にUIを更新（DB更新を待たない）
const handleComplete = async (taskId: string) => {
  // 1. UIを先に更新
  setTasks(prev => prev.map(t => 
    t.id === taskId ? { ...t, completed: true } : t
  ));
  
  // 2. DBを非同期で更新
  try {
    await completeTask(taskId);
  } catch (error) {
    // エラー時はロールバック
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, completed: false } : t
    ));
  }
};
```

#### 4. React Query / SWRの導入
```bash
npm install @tanstack/react-query
```

```typescript
// データ取得をキャッシュ＆自動再取得
import { useQuery } from '@tanstack/react-query';

function Dashboard() {
  const { data: periods, isLoading } = useQuery({
    queryKey: ['test-periods', userProfile?.gradeId],
    queryFn: () => getTestPeriodsByClassId(userProfile.gradeId),
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
    enabled: !!userProfile?.gradeId, // gradeIdがある時のみ実行
  });
  
  return isLoading ? <Skeleton /> : <PeriodList periods={periods} />;
}
```

---

### 🚀 中長期的な改善（3-7日で実装可能）

#### 1. Server Componentsへの段階的移行

**現在のクライアントコンポーネント**:
```typescript
// app/dashboard/page.tsx ('use client')
'use client';
export default function Dashboard() {
  const [periods, setPeriods] = useState([]);
  
  useEffect(() => {
    loadPeriods();
  }, []);
}
```

**改善後（Server Component）**:
```typescript
// app/dashboard/page.tsx (Server Component)
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export default async function Dashboard() {
  const supabase = createServerComponentClient({ cookies });
  
  // サーバーサイドで並列取得
  const [
    { data: { user } },
    { data: periods }
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('test_periods').select('*')
  ]);
  
  // データが揃った状態でレンダリング
  return <DashboardClient periods={periods} user={user} />;
}
```

#### 2. APIルートの最適化

**現在の問題**:
- 各APIルートが独立してSupabaseAdmin接続を作成
- データ取得が個別に実行される

**改善策**:
```typescript
// app/api/dashboard-data/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  // 1回のAPI呼び出しで全データ取得
  const [profile, periods, tasks] = await Promise.all([
    supabaseAdmin.from('user_profiles').select('*').eq('id', userId).single(),
    supabaseAdmin.from('test_periods').select('*').eq('created_by', userId),
    supabaseAdmin.from('tasks').select('*').eq('assigned_to', userId)
  ]);
  
  return NextResponse.json({ profile, periods, tasks });
}
```

#### 3. データベースクエリの最適化

**JOINを活用して取得回数を削減**:
```sql
-- ❌ 現在: N+1クエリ問題
-- 1. test_periodsを取得
-- 2. 各periodに対してtasksを取得（N回）

-- ✅ 改善: 1回のJOINで取得
SELECT 
  tp.*,
  json_agg(t.*) as tasks
FROM test_periods tp
LEFT JOIN tasks t ON t.test_period_id = tp.id
WHERE tp.created_by = $1
GROUP BY tp.id;
```

```typescript
// Supabaseで実装
const { data } = await supabase
  .from('test_periods')
  .select(`
    *,
    tasks:tasks(*)
  `)
  .eq('created_by', userId);
```

---

## 実装の優先順位

### 🔥 最優先（今すぐ実装）
1. ✅ データ取得の並列化（Promise.all）
2. ✅ Optimistic UI Updates（タスク完了時）
3. ✅ React Queryの導入（キャッシング）

### 🚀 高優先（1週間以内）
4. 🔄 Server Componentsへの移行（ダッシュボード）
5. 🔄 統合APIルート（1回で全データ取得）
6. 🔄 データベースクエリ最適化（JOIN使用）

### 📈 中優先（2週間以内）
7. 🔄 Supabase Realtimeの全面活用
8. 🔄 Service Workerでのオフライン対応
9. 🔄 Progressive Web App (PWA) 化

---

## 期待される効果

### パフォーマンス改善
- **初回ロード時間**: 3-5秒 → 0.5-1秒
- **データ更新の反映**: 即座（リロード不要）
- **ネットワークリクエスト数**: 70%削減

### ユーザー体験の向上
- ✅ 白画面・空白表示の解消
- ✅ スムーズなページ遷移
- ✅ リアルタイムでのデータ同期

### 開発者体験の向上
- ✅ コードの可読性向上
- ✅ バグの発生率低下
- ✅ メンテナンス性の向上

---

## 参考リソース

- [Next.js App Router Best Practices](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Supabase with Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Optimistic UI Updates](https://www.apollographql.com/docs/react/performance/optimistic-ui/)

