import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/stats/student/subjects?student_id=...&period_id=...
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

    // AuthZ: teacher only（プロトタイプ）
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()
    if (profErr || !profile || profile.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
    }

    // タスク取得（メインタスク除外）
    let query = supabaseAdmin
      .from('tasks')
      .select('subject, status, task_type, test_period_id')
      .eq('assigned_to', studentId)
      .neq('task_type', 'parent')

    if (periodId) {
      // カンマ区切りの複数IDに対応
      const periodIds = periodId.split(',').filter(Boolean);
      if (periodIds.length === 1) {
        query = query.eq('test_period_id', periodIds[0]);
      } else if (periodIds.length > 1) {
        query = query.in('test_period_id', periodIds);
      }
    }

    const { data: tasks, error } = await query
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }

    // 科目別集計
    const subjectMap = new Map<string, { total: number, completed: number }>()
    for (const t of tasks || []) {
      const subj = t.subject || '未分類'
      const cur = subjectMap.get(subj) || { total: 0, completed: 0 }
      cur.total += 1
      if (t.status === 'completed') cur.completed += 1
      subjectMap.set(subj, cur)
    }

    const result = Array.from(subjectMap.entries()).map(([subject, v]) => ({
      subject,
      total: v.total,
      completed: v.completed,
      completionRate: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0,
    }))

    return NextResponse.json(result, { status: 200, headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
