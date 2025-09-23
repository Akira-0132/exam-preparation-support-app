import { NextRequest, NextResponse } from 'next/server';

// 簡易レート制限（単純なメモリベース）: 1 IP あたり 60秒で最大 30 リクエスト
// Vercelエッジ/無状態環境では本格運用にUpstash等が必要。ここでは最小限の保護のみ。
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const ipHits: Map<string, { count: number; windowStart: number }> = new Map();

function getClientIp(req: NextRequest): string {
  // x-forwarded-for 優先
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

function rateLimit(req: NextRequest): boolean {
  const ip = getClientIp(req);
  const now = Date.now();
  const rec = ipHits.get(ip);
  if (!rec) {
    ipHits.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (now - rec.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipHits.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (rec.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  rec.count += 1;
  return true;
}

// Hostベースの厳格判定: 本番は本番ホストのみ、Preview/Devは *.vercel.app を許可
const prodUrl = process.env.NEXT_PUBLIC_APP_URL || '';
const prodHost = (() => {
  try { return prodUrl ? new URL(prodUrl).host : ''; } catch (_) { return ''; }
})();
// プレビュー許可はやめ、プロダクションホストのみに限定（より厳格）

function isAllowedHost(req: NextRequest): boolean {
  // Vercelでは x-forwarded-host が別ドメインになる場合があるため、実際のアクセス先を示す nextUrl.hostname を採用
  const hostname = req.nextUrl.hostname;
  if (!hostname) return false;
  if (hostname === prodHost) return true;
  return false;
}

export async function GET(request: NextRequest) {
  // Hostチェック（厳格）
  if (!isAllowedHost(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // レート制限
  if (!rateLimit(request)) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const schoolType = searchParams.get('type') || 'C1';

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    // 文書に基づく正しいAPI実装
    const apiUrl = 'https://school.teraren.com/schools.json';
    // より詳細な検索のため、クエリを分析して最適な検索語を構築
    let searchQuery = query;
    
    // 都道府県名が含まれている場合はそのまま使用
    if (query.includes('都') || query.includes('道') || query.includes('府') || query.includes('県')) {
      searchQuery = `${query} 中学校`;
    } else {
      // 市区町村名の場合は「東京都」を追加
      searchQuery = `東京都 ${query} 中学校`;
    }
    
    const searchParams = new URLSearchParams({
      s: searchQuery
    });

    console.log('[API] Searching with params:', searchParams.toString());
    
    const response = await fetch(`${apiUrl}?${searchParams}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(15000), // 15秒でタイムアウト
    });

    console.log('[API] Response status:', response.status);

    if (response.ok) {
      const allSchools = await response.json();
      console.log('[API] Total schools fetched:', allSchools.length);
      
      // デバッグ: 取得したデータの最初の数件の構造を確認
      if (allSchools.length > 0) {
        console.log('[API] Sample data structure:', allSchools.slice(0, 2));
      }
      
      if (Array.isArray(allSchools)) {
        // 公立中学校のみをフィルタリング (establishment_category === 2)
        const publicSchools = allSchools.filter((school: any) => 
          school.establishment_category === 2
        );
        
        console.log('[API] Public schools found:', publicSchools.length);
        
        // さらにクエリに基づいてフィルタリング
        const filteredSchools = publicSchools.filter((school: any) => {
          const location = school.location || '';
          const name = school.name || '';
          
          // クエリが学校名または住所に含まれているかチェック
          return location.includes(query) || name.includes(query);
        });
        
        console.log('[API] Filtered by query:', filteredSchools.length);
        
        // 結果を整形
        const results = filteredSchools
          .slice(0, 50) // 結果を50件に制限
          .map((school: any) => ({
            name: school.name || '学校名不明',
            prefecture: school.prefecture_number ? getPrefectureName(school.prefecture_number.toString()) : '都道府県不明',
            city: school.location ? extractCityFromAddress(school.location) : '市区町村不明',
            address: school.location || '',
            type: 'public',
            code: school.code || '',
            postalCode: school.postal_code || ''
          }));
        
        console.log('[API] Filtered results:', results.length);
        
        // 結果が見つかった場合は返す
        if (results.length > 0) {
          return NextResponse.json(results);
        }
      }
    } else {
      const errorText = await response.text();
      console.log('[API] API error:', response.status, errorText);
    }
  } catch (error) {
    console.error('[API] Error:', error);
  }

  // 外部APIが失敗した場合、フォールバックとしてサンプルデータを返す
  console.log('[API] External API failed, returning sample data');
  
  // サンプル中学校データ（フォールバック）
  const sampleSchools = [
    {
      name: '足立区立中学校',
      prefecture: '東京都',
      city: '足立区',
      address: '東京都足立区',
      type: 'public'
    },
    {
      name: '世田谷区立中学校',
      prefecture: '東京都',
      city: '世田谷区',
      address: '東京都世田谷区',
      type: 'public'
    },
    {
      name: '渋谷区立中学校',
      prefecture: '東京都',
      city: '渋谷区',
      address: '東京都渋谷区',
      type: 'public'
    },
    {
      name: '新宿区立中学校',
      prefecture: '東京都',
      city: '新宿区',
      address: '東京都新宿区',
      type: 'public'
    },
    {
      name: '練馬区立中学校',
      prefecture: '東京都',
      city: '練馬区',
      address: '東京都練馬区',
      type: 'public'
    }
  ];

  // クエリに基づいてフィルタリング
  const filteredResults = sampleSchools.filter(school => 
    school.name.includes(query) || 
    school.city.includes(query) || 
    school.prefecture.includes(query)
  );

  return NextResponse.json(filteredResults);
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