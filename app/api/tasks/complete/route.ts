import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'

// POST /api/tasks/complete
// Authorization: Bearer <access_token> (optional, falls back to cookies)
// body: { taskId: string, actualTime?: number }
export async function POST(req: NextRequest) {
  try {
    let user: any = null
    let userId: string | null = null

    // Strategy 1: Try Bearer token first (if provided)
    const authz = req.headers.get('authorization') || ''
    const bearerToken = authz.toLowerCase().startsWith('bearer ') ? authz.slice(7) : null
    
    if (bearerToken) {
      console.log('[tasks/complete] Using Bearer token authentication')
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(bearerToken)
      if (userErr || !userData?.user) {
        console.error('[tasks/complete] Bearer token auth failed:', userErr)
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
      user = userData.user
      userId = user.id
      console.log('[tasks/complete] Bearer token auth successful, userId:', userId)
    } else {
      // Strategy 2: Fall back to cookie-based authentication
      console.log('[tasks/complete] Using cookie-based authentication')
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
      const { data: { user: cookieUser }, error: userErr } = await supabase.auth.getUser()
      if (userErr || !cookieUser) {
        console.error('[tasks/complete] Cookie auth failed:', userErr)
        console.error('[tasks/complete] Cookie store keys:', Array.from(cookieStore.getAll().map(c => c.name)))
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = cookieUser
      userId = user.id
      console.log('[tasks/complete] Cookie auth successful, userId:', userId)
    }

    const body = await req.json().catch(() => ({}))
    const taskId = body?.taskId as string | undefined
    const actualTime = body?.actualTime as number | undefined
    if (!taskId) {
      console.error('[tasks/complete] Missing taskId in request body')
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    console.log('[tasks/complete] Processing task completion:', { taskId, userId, actualTime })

    // 所有権確認（対象タスクが自分のものであること）
    // Bearer tokenの場合はsupabaseAdminを使用、cookieの場合はRLSが効く
    const supabaseClient = bearerToken ? supabaseAdmin : createRouteHandlerClient<Database>({ cookies: () => cookies() })
    
    const { data: taskRow, error: taskFetchErr } = await supabaseClient
      .from('tasks')
      .select('id, assigned_to')
      .eq('id', taskId)
      .maybeSingle()

    if (taskFetchErr) {
      console.error('[tasks/complete] Fetch task error:', taskFetchErr)
      return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
    }
    if (!taskRow) {
      console.error('[tasks/complete] Task not found:', taskId)
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    if (taskRow.assigned_to !== userId) {
      console.error('[tasks/complete] Forbidden: Task assigned to different user', {
        taskId,
        taskAssignedTo: taskRow.assigned_to,
        userId
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updateData: any = {
      status: 'completed',
      completed_at: new Date().toISOString(),
    }
    if (typeof actualTime === 'number') {
      updateData.actual_time = actualTime
    }

    console.log('[tasks/complete] Updating task with data:', updateData)
    const { error: updateErr } = await supabaseClient
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)

    if (updateErr) {
      console.error('[tasks/complete] Update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }

    console.log('[tasks/complete] Task completed successfully:', taskId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[tasks/complete] Unexpected error:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}


