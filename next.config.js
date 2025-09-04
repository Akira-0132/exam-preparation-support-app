/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel/Supabase用の設定
  // output: 'export', // 静的エクスポートが必要な場合はコメントアウトを解除
  trailingSlash: false,
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig