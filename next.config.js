/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel/Supabase用の設定
  // output: 'export', // 静的エクスポートが必要な場合はコメントアウトを解除
  trailingSlash: false,
  images: {
    unoptimized: true
  },
  // 本番ビルドでconsole.*を除去（開発は除外）
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig