import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const schoolType = searchParams.get('type') || 'C1';

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    // 複数のAPIエンドポイントを試行
    const apiUrls = [
      'https://school.teraren.com/school.json',
      'https://school.teraren.com/schools.json',
      'https://school.teraren.com/api/schools',
      'https://school.teraren.com/api/schools.json'
    ];
    
    for (const apiUrl of apiUrls) {
      console.log('[API] Trying API:', apiUrl);
      console.log('[API] Search query:', query);
      
      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        console.log('[API] Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[API] Total schools fetched:', data.length);
          
          // デバッグ: 取得したデータの最初の数件の構造を確認
          if (data.length > 0) {
            console.log('[API] Sample data structure:', data.slice(0, 2));
          }
          
          // クライアント側でフィルタリング
          if (Array.isArray(data)) {
            // デバッグ: 中学校の数を確認
            const juniorHighSchools = data.filter((school: any) => school.school_type === 'C1');
            console.log('[API] Junior high schools found:', juniorHighSchools.length);
            
            const results = data
              .filter((school: any) => {
                // 中学校のみフィルタ
                if (school.school_type !== 'C1') return false;
                
                // クエリに部分一致する学校を検索（locationで検索）
                const locationMatch = school.location && school.location.includes(query);
                
                return locationMatch;
              })
              .slice(0, 50) // 結果を50件に制限
              .map((school: any) => ({
                name: school.location ? extractSchoolNameFromLocation(school.location) : '学校名不明',
                prefecture: school.prefecture_number ? getPrefectureName(school.prefecture_number.toString()) : '都道府県不明',
                city: school.location ? extractCityFromAddress(school.location) : '市区町村不明',
                address: school.location || '',
                type: 'public'
              }));
            
            console.log('[API] Filtered results:', results.length);
            
            // 外部APIで中学校が見つかった場合は返す
            if (results.length > 0) {
              return NextResponse.json(results);
            }
          }
        } else {
          const errorText = await response.text();
          console.log('[API] API error:', response.status, errorText);
        }
      } catch (fetchError) {
        console.log('[API] Fetch error for', apiUrl, ':', fetchError);
        continue; // 次のURLを試行
      }
    }
  } catch (error) {
    console.error('[API] Error:', error);
  }

  // 外部APIが失敗した場合、空の結果を返す（自前データベースは使用しない）
  console.log('[API] External API failed, returning empty results');
  return NextResponse.json([]);
}


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

// 住所から学校名を抽出（推測）
function extractSchoolNameFromLocation(location: string): string {
  if (!location) return '学校名不明';
  
  // 住所から市区町村を抽出して学校名として使用
  const cityMatch = location.match(/(?:都|道|府|県)(.+?[市区町村])/);
  if (cityMatch) {
    const city = cityMatch[1];
    return `${city}立中学校`; // 例: "足立区立中学校"
  }
  
  return '学校名不明';
}

// 住所から市区町村を抽出
function extractCityFromAddress(address: string): string {
  if (!address) return '市区町村不明';
  
  // 都道府県を除いた住所から市区町村を抽出
  const match = address.match(/(?:都|道|府|県)(.+?[市区町村])/);
  return match ? match[1] : '市区町村不明';
}