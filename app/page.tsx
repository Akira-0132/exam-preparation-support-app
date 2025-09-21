'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function Home() {
  const router = useRouter();
  const { userProfile: user, currentUser, loading } = useAuth();
  const [showTimeout, setShowTimeout] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  // Home component render

  useEffect(() => {
    
    // ローディングタイムアウト処理
    if (loading) {
      // 既存のタイムアウトをクリア
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // 2秒後にタイムアウトメッセージを表示（短縮）
      timeoutRef.current = setTimeout(() => {
        if (loading) {
          setShowTimeout(true);
        }
      }, 2000);
    } else {
      // ローディングが終了したらタイムアウトをクリア
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setShowTimeout(false);
    }
    
    // ユーザーがログインしている場合はダッシュボードへ
    if (user && !loading) {
      router.push('/dashboard');
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, currentUser, loading, router]);

  if (loading && !showTimeout) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-blue-200 rounded-full mx-auto mb-4"></div>
          <div className="h-4 bg-blue-200 rounded w-48"></div>
        </div>
      </main>
    );
  }
  
  if (loading && showTimeout) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-200 rounded-full mx-auto mb-4 animate-pulse"></div>
          <p className="text-gray-600 mb-4">読み込みに時間がかかっています...</p>
          <Button
            onClick={() => {
              window.location.reload();
            }}
            variant="outline"
            size="sm"
          >
            ページを再読み込み
          </Button>
        </div>
      </main>
    );
  }

  if (user) {
    return null; // リダイレクト中
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-600">
              定期試験対策アプリ
            </h1>
            <div className="space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push('/login')}
              >
                ログイン
              </Button>
              <Button
                onClick={() => router.push('/signup')}
              >
                新規登録
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* メインコンテンツ */}
          <div className="mb-16">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              効率的な
              <span className="text-blue-600">定期試験対策</span>
              を実現
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              中学生のための定期試験対策支援アプリ。
              科目別の学習計画、進捗管理、タスク管理で確実に成績アップを目指しましょう。
            </p>
            <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
              <Button
                size="lg"
                onClick={() => router.push('/signup')}
                className="w-full sm:w-auto"
              >
                今すぐ始める
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push('/login')}
                className="w-full sm:w-auto"
              >
                ログイン
              </Button>
            </div>
          </div>

          {/* 機能紹介 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <Card variant="elevated">
              <CardHeader>
                <div className="w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <CardTitle>学習計画の自動生成</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  テスト期間と科目を設定するだけで、最適な学習計画を自動生成。
                  自信度に基づいたパーソナライズされた計画を作成します。
                </p>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardHeader>
                <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <CardTitle>進捗の見える化</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  科目別・タスク別の進捗を視覚的に表示。
                  完了率や学習時間を確認しながら、モチベーションを維持できます。
                </p>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardHeader>
                <div className="w-12 h-12 mx-auto mb-4 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                </div>
                <CardTitle>効率的なタスク管理</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  優先度や期限に基づいたタスク管理で、効率的に学習を進められます。
                  期限切れの防止と時間配分の最適化を支援します。
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 対象ユーザー */}
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">こんな方にオススメ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div>
                <h3 className="text-lg font-semibold text-blue-600 mb-3">生徒の皆さん</h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    定期試験の対策を効率的に進めたい
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    学習計画を立てるのが苦手
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    進捗を可視化してモチベーションを上げたい
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    複数科目の学習を管理したい
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-600 mb-3">講師の皆さん</h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    生徒の学習進捗を把握したい
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    クラス全体の試験対策を管理したい
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    個別指導のデータを蓄積したい
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    効果的な学習計画を提案したい
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* フッター */}
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2024 定期試験対策アプリ. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}