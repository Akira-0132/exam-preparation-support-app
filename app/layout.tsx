import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/context/AuthContext";
import QueryProvider from "@/lib/context/QueryProvider";
import { createServerSupabase } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { clientLog } from '@/lib/utils/clientLogger';

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
  const t0 = Date.now();
  const supabase = await createServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  const t1 = Date.now();
  
  console.log('[RootLayout SSR] session:', !!session, 'user:', session?.user?.id);
  
  let initialProfile = null;
  if (session?.user) {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    const t2 = Date.now();
    
    console.log('[RootLayout SSR] profile data:', !!data, 'role:', data?.role);
    if (data) {
      initialProfile = {
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        role: data.role,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        ...(data.role === 'student' && {
          classId: data.grade_id,
          gradeId: data.grade_id,
          schoolId: data.school_id,
          grade: data.grade,
          studentNumber: data.student_number,
        }),
        ...(data.role === 'teacher' && {
          managedClassIds: data.managed_class_ids || [],
          subject: data.subject,
        }),
      } as any;
      
      console.log('[RootLayout SSR] final profile:', {
        id: initialProfile.id,
        role: initialProfile.role,
        displayName: initialProfile.displayName
      });
    }
    // SSR計測をclient_logsに送信
    if (typeof clientLog === 'function') {
      try {
        await clientLog('[SSR] layout', { getSession: t1 - t0, getProfile: t2 - t1 });
      } catch {}
    }
  }
  
  console.log('[RootLayout SSR] Passing to AuthProvider - session:', !!session, 'profile:', !!initialProfile);
  
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