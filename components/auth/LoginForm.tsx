'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { LoginForm as LoginFormData } from '@/types';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function LoginForm() {
  const router = useRouter();
  const { login, currentUser, userProfile, loading } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<LoginFormData>>({});
  const [submitting, setSubmitting] = useState(false);
  
  // 既にログイン済みならログインページに留まらない
  useEffect(() => {
    if (currentUser || userProfile) {
      router.replace('/dashboard');
    }
  }, [currentUser, userProfile, router]);

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginFormData> = {};

    if (!formData.email) {
      newErrors.email = 'メールアドレスは必須です';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '有効なメールアドレスを入力してください';
    }

    if (!formData.password) {
      newErrors.password = 'パスワードは必須です';
    } else if (formData.password.length < 6) {
      newErrors.password = 'パスワードは6文字以上で入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      console.log('[LoginForm] Starting login...');
      await login(formData.email, formData.password);
      console.log('[LoginForm] Login successful, redirecting to dashboard...');
      // 即時に置換遷移（戻るボタンで戻らない）
      router.replace('/dashboard');
    } catch (error: any) {
      console.error('[LoginForm] Login error caught:', error);
      let errorMessage = 'ログインに失敗しました';
      
      if (error?.message) {
        // Supabaseエラーメッセージの処理
        const message = error.message.toLowerCase();
        if (message.includes('invalid') || message.includes('credentials')) {
          errorMessage = 'メールアドレスまたはパスワードが正しくありません';
        } else if (message.includes('email')) {
          errorMessage = '有効なメールアドレスを入力してください';
        } else if (message.includes('too many requests')) {
          errorMessage = 'ログイン試行回数が多すぎます。しばらく時間をおいてから再度お試しください';
        } else {
          // その他のエラーメッセージも表示
          errorMessage = `ログインに失敗しました: ${error.message}`;
        }
      }
      
      setErrors({ email: errorMessage });
    } finally {
      // 画面遷移できなかった場合でもスピナーを止める
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // エラーがある場合はクリア
    if (errors[name as keyof LoginFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            定期試験対策アプリ
          </h1>
          <p className="mt-2 text-gray-600">
            アカウントにログインしてください
          </p>
        </div>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>ログイン</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                name="email"
                label="メールアドレス"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                fullWidth
                disabled={submitting}
                placeholder="example@school.ac.jp"
              />

              <Input
                type="password"
                name="password"
                label="パスワード"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                fullWidth
                disabled={submitting}
                placeholder="パスワードを入力"
              />

              <Button
                type="submit"
                fullWidth
                loading={submitting}
                disabled={submitting}
              >
                ログイン
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                アカウントをお持ちでない方は
              </p>
              <Button
                variant="ghost"
                onClick={() => router.push('/signup')}
                disabled={submitting}
              >
                新規登録はこちら
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}