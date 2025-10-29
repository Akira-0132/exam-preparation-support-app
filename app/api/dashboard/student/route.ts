import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { timer } from '@/lib/utils/timer'

export async function GET(request: Request) {
  const t = timer('api-student');
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const periodId = searchParams.get('periodId')
    if (!studentId || !periodId) {
      return NextResponse.json({ error: 'studentId and periodId are required' }, { status: 400 })
    }
    t.lap('auth');

    const { data: tasks, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('assigned_to', studentId)
      .eq('test_period_id', periodId)
    t.lap('db-tasks');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const toYMD = (d?: string | null) => (d ? new Date(d).toISOString().split('T')[0] : '')

    const todayTasks = (tasks || []).filter(t => toYMD((t as any).due_date || (t as any).dueDate) === todayStr)
    const incompleteTasks = (tasks || []).filter(t => (t as any).status !== 'completed')

    const total = tasks?.length ?? 0
    const completed = (tasks || []).filter(t => (t as any).status === 'completed').length
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100)
    t.lap('compute');

    const response = NextResponse.json({
      todayTasks,
      incompleteTasks,
      statistics: { total, completed, completionRate }
    });
    response.headers.set('Server-Timing', t.header());
    return response;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}


