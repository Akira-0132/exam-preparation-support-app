import { NextRequest, NextResponse, cookies } from 'next/server'
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { supabaseAdmin } from '@/lib/supabase-admin'

// POST /api/tasks/complete
// Authorization: Bearer <access_token>
// body: { taskId: string, actualTime?: number }
export async function POST(req: NextRequest) {
  try {
    const authz = req.headers.get('authorization') || ''
    let token = authz.toLowerCase().startsWith('bearer ')
      ? authz.slice(7).trim()
      : ''

    // Bearer ヘッダーが無い場合、Supabaseの認証クッキーからアクセストークンを抽出
    if (!token) {
      try {
        const all = cookies();
        // よくあるクッキー名の候補を探す
        const candidates = [
          'supabase-auth-token',
          '__Host-supabase-auth-token',
        ];
        // さらに "auth-token" を含むキーを全走査
        for (const c of all.getAll()) {
          if (!c || !c.name) continue;
          if (!candidates.includes(c.name) && !c.name.includes('auth-token')) continue;
          const raw = c.value;
          if (!raw) continue;
          // URLデコードを試す
          const decoded = (() => { try { return decodeURIComponent(raw); } catch { return raw; } })();
          // JSONとしてパースして access_token を探索
          try {
            const parsed = JSON.parse(decoded);
            const fromCurrent = parsed?.currentSession?.access_token as string | undefined;
            if (fromCurrent) { token = fromCurrent; break; }
            // 配列形式の場合
            if (Array.isArray(parsed)) {
              const found = parsed.find((v: any) => typeof v?.access_token === 'string');
              if (found?.access_token) { token = found.access_token; break; }
            }
          } catch {
            // JSONでなければスキップ
          }
        }
      } catch (e) {
        console.error('[tasks/complete] Failed to read auth cookie:', e)
      }
    }

    if (!token) {
      return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const taskId = body?.taskId as string | undefined
    const actualTime = body?.actualTime as number | undefined
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    // 所有権確認（対象タスクが自分のものであること）
    const { data: taskRow, error: taskFetchErr } = await supabaseAdmin
      .from('tasks')
      .select('id, assigned_to')
      .eq('id', taskId)
      .maybeSingle()

    if (taskFetchErr) {
      console.error('[tasks/complete] Fetch task error:', taskFetchErr)
      return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
    }
    if (!taskRow || taskRow.assigned_to !== userData.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updateData: any = {
      status: 'completed',
      completed_at: new Date().toISOString(),
    }
    if (typeof actualTime === 'number') {
      updateData.actual_time = actualTime
    }

    const { error: updateErr } = await supabaseAdmin
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)

    if (updateErr) {
      console.error('[tasks/complete] Update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[tasks/complete] Unexpected error:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}


