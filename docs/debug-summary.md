# Debug Summary 2025-10-29

## 1. 現状

| 項目 | 状態 |
| --- | --- |
| **本番ダッシュボード白画面** | 依然として発生 |
| **SSR で session / userProfile 取得** | `getUser()` へ切替済みだが `client_logs` に `[SSR] layout` が出ず Cookie 取得失敗の可能性 |
| **ウィンドウ切替で白画面** | `isInitialLoad` 改修で改善予定 → 要確認 |
| **デバッグ手段** | `?debug=1` で eruda コンソール、`window.*` で状態確認 |
| **Server-Timing** | `/api/dashboard/student` で計測実装済み |
| **React Query 再取得抑制** | `refetchOnWindowFocus:false` 済み |

## 2. 直近の変更

1. **SSR Cookie 問題調査** – `getUser()` 切替
2. **eruda デバッグ導入** – `?debug=1` で本番 Console
3. **Auth / Dashboard 状態を `window` へ公開**
4. **Server-Timing & clientLog** – SSR/API 処理時間送信

## 3. 未解決の主要問題

| 優先度 | 問題 | 想定原因 | 次のアクション |
| :-: | --- | --- | --- |
| ★ | **SSR で user が null → 白画面** | Edge Runtime で Cookie 読めず | eruda で `currentUser` を確認、Cookie SameSite/Lax or 独自ドメイン検討 |
| ★ | **`.next` readlink エラー (Win+OneDrive)** | シンボリックリンク破損 | 毎ビルド前に `.next` 削除 or CI ビルド |
| ☆ | **DB クエリ遅延** | Index 不足 | m4: 複合インデックス、m3: 集約 API |
| ☆ | **Realtime サブスク範囲広い** | フィルタ不足 | m5: 対象ユーザー＋期間に限定 |

## 4. デバッグ手順

1. アクセス: `https://<domain>/dashboard?debug=1`
2. コンソールで
   ```js
   window.currentUser
   window.userProfile
   window.isInitialLoad
   window.dataInitialized
   ```
3. `client_logs` で SSR 記録確認
   ```sql
   select message, data, created_at
   from client_logs
   where message='[SSR] layout'
   order by created_at desc
   limit 20;
   ```

## 5. 次のステップ案

1. eruda で実機値確認 → Cookie 問題確定
2. SameSite/Cookie or カスタムドメイン対応
3. m3, m4, m5 実装で速度改善
4. `.next` エラー対策: OneDrive 同期除外 or CI ビルド
