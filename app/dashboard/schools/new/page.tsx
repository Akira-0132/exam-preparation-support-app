'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { searchSchools, createSchool, fetchSchoolsWithGrades } from '@/lib/supabase/schools';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function SchoolRegistrationPage() {
  const router = useRouter();
  const { userProfile } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string>('');
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile && userProfile.role !== 'teacher') {
      router.push('/dashboard');
    }
  }, [userProfile, router]);

  const handleSearch = async () => {
    setError('');
    setIsSearching(true);
    try {
      const data = await searchSchools(query);
      setResults(data || []);
    } catch (e) {
      setError('検索に失敗しました');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreate = async (name: string, prefecture?: string, city?: string) => {
    setError('');
    setCreating(name);
    try {
      await createSchool(name, prefecture, city);
      await fetchSchoolsWithGrades();
      router.push('/dashboard/test-setup');
    } catch (e) {
      setError('登録に失敗しました');
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">学校登録</h1>
        <Button onClick={() => router.push('/dashboard')}>ダッシュボードへ</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>学校を検索</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="学校名 / 地域 を入力（例: 足立区 伊興中学校）"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button onClick={handleSearch} loading={isSearching}>検索</Button>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          {results.length > 0 && (
            <div className="border rounded divide-y">
              {results.map((s: any, idx: number) => (
                <div key={idx} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-sm text-gray-600">{s.prefecture} {s.city}</div>
                  </div>
                  <Button size="sm" loading={creating === s.name} onClick={() => handleCreate(s.name, s.prefecture, s.city)}>
                    登録
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>手動登録</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ManualForm onCreate={handleCreate} creating={!!creating} />
        </CardContent>
      </Card>
    </div>
  );
}

function ManualForm({ onCreate, creating }: { onCreate: (name: string, prefecture?: string, city?: string) => void; creating: boolean; }) {
  const [name, setName] = useState('');
  const [pref, setPref] = useState('');
  const [city, setCity] = useState('');
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <input className="border rounded px-3 py-2" placeholder="学校名（必須）" value={name} onChange={(e)=>setName(e.target.value)} />
      <input className="border rounded px-3 py-2" placeholder="都道府県（任意）" value={pref} onChange={(e)=>setPref(e.target.value)} />
      <input className="border rounded px-3 py-2" placeholder="市区町村（任意）" value={city} onChange={(e)=>setCity(e.target.value)} />
      <div className="md:col-span-3">
        <Button disabled={!name.trim()} loading={creating} onClick={()=>onCreate(name.trim(), pref.trim()||undefined, city.trim()||undefined)}>登録する</Button>
      </div>
    </div>
  );
}


