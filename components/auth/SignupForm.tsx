'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { RegisterForm as RegisterFormData } from '@/types';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const gradeOptions = [
  { value: '1', label: '1年生' },
  { value: '2', label: '2年生' },
  { value: '3', label: '3年生' },
];

const subjectOptions = [
  { value: '国語', label: '国語' },
  { value: '数学', label: '数学' },
  { value: '英語', label: '英語' },
  { value: '理科', label: '理科' },
  { value: '社会', label: '社会' },
  { value: '音楽', label: '音楽' },
  { value: '美術', label: '美術' },
  { value: '保健体育', label: '保健体育' },
  { value: '技術家庭', label: '技術・家庭' },
  { value: 'その他', label: 'その他' },
];

type FormErrors = Partial<{ [K in keyof RegisterFormData]: string }> & { general?: string };

export default function SignupForm() {
  const router = useRouter();
  const { register } = useAuth();
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    role: 'student',
    grade: undefined,
    studentNumber: '',
    classId: '',
    subject: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

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

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'パスワード確認は必須です';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'パスワードが一致しません';
    }

    if (!formData.displayName) {
      newErrors.displayName = '表示名は必須です';
    }

    if (formData.role === 'student') {
      if (!formData.grade) {
        newErrors.grade = '学年は必須です';
      }
      if (!formData.studentNumber) {
        newErrors.studentNumber = '生徒番号は必須です';
      }
      if (!formData.classId) {
        newErrors.classId = 'クラスIDは必須です';
      }
    } else if (formData.role === 'teacher') {
      if (!formData.subject) {
        newErrors.subject = '担当科目は必須です';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      // registerにはemail、password、profileDataを渡す
      const profileData = {
        displayName: formData.displayName,
        role: formData.role as 'student' | 'teacher',
        ...(formData.role === 'student' && {
          classId: formData.classId,
          grade: formData.grade,
          studentNumber: formData.studentNumber
        }),
        ...(formData.role === 'teacher' && {
          subject: formData.subject
        })
      };
      
      await register(formData.email, formData.password, profileData);
      // ダッシュボードにリダイレクト
      router.push('/dashboard');
    } catch (error: any) {
      console.error('アカウント作成エラー:', error);
      let errorMessage = 'アカウント作成に失敗しました';
      
      if (error?.message) {
        const message = error.message.toLowerCase();
        if (message.includes('email') && message.includes('already')) {
          errorMessage = 'このメールアドレスは既に使用されています';
        } else if (message.includes('email') && message.includes('invalid')) {
          errorMessage = '有効なメールアドレスを入力してください';
        } else if (message.includes('password') && message.includes('weak')) {
          errorMessage = 'より強力なパスワードを設定してください';
        } else if (message.includes('signup') && message.includes('disabled')) {
          errorMessage = 'アカウント作成が無効化されています';
        }
      }
      
      setErrors({ email: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let parsedValue: any = value;
    
    if (name === 'grade' && value) {
      parsedValue = parseInt(value);
    }
    
    setFormData(prev => ({ ...prev, [name]: parsedValue }));
    
    // エラーがある場合はクリア
    if (errors[name as keyof RegisterFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as 'student' | 'teacher';
    setFormData(prev => ({
      ...prev,
      role: newRole,
      // ロール変更時に不要なフィールドをクリア
      grade: undefined,
      studentNumber: '',
      classId: '',
      subject: '',
    }));
    setErrors({});
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            定期試験対策アプリ
          </h1>
          <p className="mt-2 text-gray-600">
            新規アカウントを作成してください
          </p>
        </div>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>新規登録</CardTitle>
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
                disabled={loading}
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
                disabled={loading}
                placeholder="6文字以上"
              />

              <Input
                type="password"
                name="confirmPassword"
                label="パスワード確認"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                fullWidth
                disabled={loading}
                placeholder="パスワードを再入力"
              />

              <Input
                type="text"
                name="displayName"
                label="表示名"
                value={formData.displayName}
                onChange={handleChange}
                error={errors.displayName}
                fullWidth
                disabled={loading}
                placeholder="山田太郎"
              />

              <Select
                name="role"
                label="アカウントの種類"
                value={formData.role}
                onChange={handleRoleChange}
                options={[
                  { value: 'student', label: '生徒' },
                  { value: 'teacher', label: '講師' },
                ]}
                fullWidth
                disabled={loading}
              />

              {formData.role === 'student' && (
                <>
                  <Select
                    name="grade"
                    label="学年"
                    value={formData.grade?.toString() || ''}
                    onChange={handleChange}
                    error={errors.grade}
                    options={gradeOptions}
                    fullWidth
                    disabled={loading}
                    placeholder="学年を選択"
                  />

                  <Input
                    type="text"
                    name="studentNumber"
                    label="生徒番号"
                    value={formData.studentNumber}
                    onChange={handleChange}
                    error={errors.studentNumber}
                    fullWidth
                    disabled={loading}
                    placeholder="例: 20240101"
                  />

                  <Input
                    type="text"
                    name="classId"
                    label="クラスID"
                    value={formData.classId}
                    helperText="講師から提供されたクラスIDを入力してください"
                    onChange={handleChange}
                    error={errors.classId}
                    fullWidth
                    disabled={loading}
                    placeholder="例: 3A2024"
                  />
                </>
              )}

              {formData.role === 'teacher' && (
                <Select
                  name="subject"
                  label="担当科目"
                  value={formData.subject}
                  onChange={handleChange}
                  error={errors.subject}
                  options={subjectOptions}
                  fullWidth
                  disabled={loading}
                  placeholder="担当科目を選択"
                />
              )}

              <Button
                type="submit"
                fullWidth
                loading={loading}
                disabled={loading}
              >
                アカウント作成
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                既にアカウントをお持ちの方は
              </p>
              <Button
                variant="ghost"
                onClick={() => router.push('/login')}
                disabled={loading}
              >
                ログインはこちら
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}