# 定期試験対策やりきり支援アプリ

生徒と講師のための定期試験対策アプリケーションです。

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **データベース**: Supabase (PostgreSQL)
- **認証**: Supabase Auth
- **フォーム管理**: React Hook Form
- **アイコン**: Heroicons
- **グラフ**: Recharts

## セットアップ

### 1. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成し、Supabase の設定値を入力してください：

```bash
cp .env.local.example .env.local
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリケーションが起動します。

## Supabase セットアップ

### 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com) でアカウントを作成
2. 新しいプロジェクトを作成
3. プロジェクト設定から API URLとAnon keyを取得
4. `.env.local` に設定値を入力

### 2. データベースのセットアップ

```bash
# マイグレーションファイルを実行
npm run supabase:migrate
```

または、Supabase Dashboardで直接SQLを実行：
- `supabase/migrations/001_initial_schema.sql` の内容をコピー
- SQL EditorでSQLを実行

## プロジェクト構造

```
├── app/                 # Next.js App Router ページ
│   ├── auth/           # 認証関連ページ
│   ├── dashboard/      # ダッシュボードページ
│   ├── globals.css     # グローバルスタイル
│   ├── layout.tsx      # ルートレイアウト
│   └── page.tsx        # ホームページ
├── components/          # 再利用可能なコンポーネント
│   ├── auth/           # 認証コンポーネント
│   ├── dashboard/      # ダッシュボードコンポーネント
│   └── ui/             # UIコンポーネント
├── lib/                # ライブラリとユーティリティ
│   ├── context/        # React Context
│   ├── hooks/          # カスタムフック
│   ├── supabase/       # Supabaseデータアクセス層
│   ├── utils/          # ユーティリティ関数
│   ├── supabase.ts     # Supabase クライアント設定
│   └── supabase-admin.ts # Supabase Admin 設定
├── types/              # TypeScript型定義
│   └── index.ts        # 主要な型定義
└── public/             # 静的ファイル
```

## 主要機能

### 生徒機能
- タスク管理
- 進捗追跡
- スケジュール管理
- 統計表示

### 講師機能
- クラス管理
- テスト期間設定
- 生徒の進捗確認
- レポート生成

## 開発

### ビルド

```bash
npm run build
```

### リンティング

```bash
npm run lint
```

### Supabaseの操作

```bash
# ローカル開発環境を起動
npm run supabase:start

# ローカル開発環境を停止
npm run supabase:stop

# データベースをリセット
npm run supabase:reset

# マイグレーションを実行
npm run supabase:migrate
```

## デプロイ

Vercel での デプロイを推奨します：

1. Vercel アカウントを作成
2. GitHub リポジトリを接続
3. 環境変数を設定
4. デプロイ

## ライセンス

MIT License