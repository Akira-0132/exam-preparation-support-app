import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/stats/student?student_id=...
// Authorization: Bearer <access_token> (teacher)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('student_id')
    const periodId = searchParams.get('period_id')
    if (!studentId) {
      return NextResponse.json({ error: 'student_id is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    // AuthN
    const authz = req.headers.get('authorization') || ''
    const token = authz.toLowerCase().startsWith('bearer ') ? authz.slice(7) : ''
    if (!token) {
      return NextResponse.json({ error: 'Missing bearer token' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    // AuthZ: teacher only（プロトタイプ。必要に応じて学校/学年で制限を強化）
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()
    if (profErr || !profile || profile.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
    }

    // 取得
    let query = supabaseAdmin
      .from('tasks')
      .select('status, task_type, due_date, test_period_id')
      .eq('assigned_to', studentId)
    if (periodId) {
      // カンマ区切りの複数IDに対応
      const periodIds = periodId.split(',').filter(Boolean);
      if (periodIds.length === 1) {
        query = query.eq('test_period_id', periodIds[0]);
      } else if (periodIds.length > 1) {
        query = query.in('test_period_id', periodIds);
      }
    }
    const { data: tasks, error: err } = await query
    if (err) {
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }

    const now = new Date()
    const actionable = (tasks || []).filter(t => t.task_type !== 'parent')
    const total = actionable.length
    const completed = actionable.filter(t => t.status === 'completed').length
    const inProgress = actionable.filter(t => t.status === 'in_progress').length
    const notStarted = actionable.filter(t => t.status === 'not_started').length
    const overdue = actionable.filter(t => t.status !== 'completed' && new Date(t.due_date) < now).length
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    return NextResponse.json({ total, completed, inProgress, notStarted, overdue, completionRate }, { status: 200, headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}


