import { supabase } from '@/lib/supabase';
import { School, Grade } from '@/types';

// 外部APIを使用した学校検索機能
export interface SchoolSearchResult {
  name: string;
  prefecture: string;
  city: string;
  address?: string;
  type: 'public' | 'private' | 'national';
}

// 学校一覧取得
export async function fetchSchools(): Promise<School[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('[fetchSchools] Error:', error);
    throw error;
  }

  return data || [];
}

// 学校作成
export async function createSchool(name: string, prefecture?: string, city?: string): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  console.log('[createSchool] Creating school:', { name, prefecture, city });

  const { data, error } = await supabase
    .from('schools')
    .insert({
      name,
      prefecture,
      city,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[createSchool] Error:', error);
    throw error;
  }

  return data.id;
}

// 学校の学年一覧取得
export async function fetchGradesBySchool(schoolId: string): Promise<Grade[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('grades')
    .select('*')
    .eq('school_id', schoolId)
    .order('grade_number', { ascending: true });

  if (error) {
    console.error('[fetchGradesBySchool] Error:', error);
    throw error;
  }

  return data || [];
}

// 学年作成
export async function createGrade(schoolId: string, gradeNumber: number, name: string): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  console.log('[createGrade] Creating grade:', { schoolId, gradeNumber, name });

  const { data, error } = await supabase
    .from('grades')
    .insert({
      school_id: schoolId,
      grade_number: gradeNumber,
      name,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[createGrade] Error:', error);
    throw error;
  }

  return data.id;
}

// 学校と学年の組み合わせ取得
export async function fetchSchoolsWithGrades(): Promise<(School & { grades: Grade[] })[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('schools')
    .select(`
      *,
      grades (*)
    `)
    .order('name', { ascending: true });

  if (error) {
    console.error('[fetchSchoolsWithGrades] Error:', error);
    throw error;
  }

  return data || [];
}

// ユーザーの学校・学年設定更新
export async function updateUserSchoolGrade(userId: string, schoolId: string, gradeId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  console.log('[updateUserSchoolGrade] Updating user:', { userId, schoolId, gradeId });

  const { error } = await supabase
    .from('user_profiles')
    .update({
      school_id: schoolId,
      grade_id: gradeId,
    })
    .eq('id', userId);

  if (error) {
    console.error('[updateUserSchoolGrade] Error:', error);
    throw error;
  }
}

// ユーザーの学校・学年情報取得
export async function fetchUserSchoolGrade(userId: string): Promise<{ school: School | null; grade: Grade | null }> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select(`
      school_id,
      grade_id,
      schools (*),
      grades (*)
    `)
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[fetchUserSchoolGrade] Error:', error);
    throw error;
  }

  return {
    school: data.schools || null,
    grade: data.grades || null,
  };
}

// 外部APIを使用した学校検索
export async function searchSchools(query: string): Promise<SchoolSearchResult[]> {
  console.log('[searchSchools] Called with query:', query);
  
  if (!query.trim() || query.length < 2) {
    console.log('[searchSchools] Query too short, returning empty array');
    return [];
  }

  try {
    // Next.js APIルートを使用してCORS問題を回避
    console.log('[searchSchools] Using Next.js API route');
    
    const apiUrl = `/api/schools/search?q=${encodeURIComponent(query)}&type=C1`;
    
    try {
      console.log('[searchSchools] Trying API:', apiUrl);
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[searchSchools] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[searchSchools] API response:', data);
        
        // APIレスポンスを標準形式に変換
        if (Array.isArray(data)) {
          const results = data.map((school: any) => ({
            name: school.name || '学校名不明',
            prefecture: school.prefecture || '都道府県不明',
            city: school.city || '市区町村不明',
            address: school.address || '',
            type: school.type || 'public'
          }));
          console.log('[searchSchools] Converted results:', results);
          return results;
        }
      } else {
        const errorText = await response.text();
        console.log('[searchSchools] API error:', response.status, errorText);
      }
    } catch (error) {
      console.log('[searchSchools] API error:', error);
    }
    
    // APIが失敗した場合のフォールバック
    console.log('[searchSchools] API failed, using fallback data');
    
    const fallbackResults: SchoolSearchResult[] = [
      {
        name: `${query}中学校`,
        prefecture: '東京都',
        city: '新宿区',
        type: 'public'
      },
      {
        name: `${query}市立中学校`,
        prefecture: '大阪府',
        city: '大阪市',
        type: 'public'
      },
      {
        name: `${query}区立中学校`,
        prefecture: '東京都',
        city: `${query}区`,
        type: 'public'
      },
      {
        name: `${query}町立中学校`,
        prefecture: '埼玉県',
        city: `${query}町`,
        type: 'public'
      }
    ];
    
    console.log('[searchSchools] Returning fallback results:', fallbackResults);
    return fallbackResults;
  } catch (error) {
    console.error('[searchSchools] Error:', error);
    return [];
  }
}

// フォールバック用の都道府県リスト
export const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

// 都道府県コードから都道府県名を取得
function getPrefectureName(code: string): string {
  const prefectureMap: { [key: string]: string } = {
    '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県', '05': '秋田県',
    '06': '山形県', '07': '福島県', '08': '茨城県', '09': '栃木県', '10': '群馬県',
    '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県', '15': '新潟県',
    '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
    '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県', '25': '滋賀県',
    '26': '京都府', '27': '大阪府', '28': '兵庫県', '29': '奈良県', '30': '和歌山県',
    '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県', '35': '山口県',
    '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県',
    '41': '佐賀県', '42': '長崎県', '43': '熊本県', '44': '大分県', '45': '宮崎県',
    '46': '鹿児島県', '47': '沖縄県'
  };
  return prefectureMap[code] || '都道府県不明';
}

// 住所から市区町村を抽出
function extractCityFromAddress(address: string): string {
  if (!address) return '市区町村不明';
  
  // 都道府県を除いた住所から市区町村を抽出
  const match = address.match(/(?:都|道|府|県)(.+?[市区町村])/);
  return match ? match[1] : '市区町村不明';
}

// デバウンス機能付きの検索
export function createDebouncedSearch(delay: number = 300) {
  let timeoutId: NodeJS.Timeout;
  
  return (query: string, callback: (results: SchoolSearchResult[]) => void) => {
    console.log('[createDebouncedSearch] Called with query:', query);
    clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      console.log('[createDebouncedSearch] Executing search after delay for:', query);
      const results = await searchSchools(query);
      console.log('[createDebouncedSearch] Calling callback with results:', results);
      callback(results);
    }, delay);
  };
}
