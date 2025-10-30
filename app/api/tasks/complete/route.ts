import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'

// POST /api/tasks/complete
// Authorization: Bearer <access_token>
// body: { taskId: string, actualTime?: number }
export async function POST(req: NextRequest) {
  try {
    // Cookieベースの認証（RLS維持）
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const taskId = body?.taskId as string | undefined
    const actualTime = body?.actualTime as number | undefined
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    // 所有権確認（対象タスクが自分のものであること）
    const { data: taskRow, error: taskFetchErr } = await supabase
      .from('tasks')
      .select('id, assigned_to')
      .eq('id', taskId)
      .maybeSingle()

    if (taskFetchErr) {
      console.error('[tasks/complete] Fetch task error:', taskFetchErr)
      return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
    }
    if (!taskRow || taskRow.assigned_to !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updateData: any = {
      status: 'completed',
      completed_at: new Date().toISOString(),
    }
    if (typeof actualTime === 'number') {
      updateData.actual_time = actualTime
    }

    const { error: updateErr } = await supabase
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


