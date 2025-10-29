import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/context/AuthContext";
import QueryProvider from "@/lib/context/QueryProvider";
import { createServerSupabase } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: "定期試験対策やりきり支援アプリ",
  description: "生徒と講師のための定期試験対策アプリケーション",
  icons: {
    icon: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  let initialProfile = null;
  if (session?.user) {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    initialProfile = data as any;
  }
  return (
    <html lang="ja" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider initialSession={session} initialUserProfile={initialProfile}>
            {children}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}