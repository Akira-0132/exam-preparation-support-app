import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/test-periods/by-student
// Authorization: Bearer <access_token> (student)
export async function GET(req: NextRequest) {
  try {
    const authz = req.headers.get('authorization') || ''
    const token = authz.toLowerCase().startsWith('bearer ') ? authz.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    // role check (optional: allow student only)
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (!profile || profile.role !== 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // find distinct test_period_id from tasks
    const { data: taskRows, error: tErr } = await supabaseAdmin
      .from('tasks')
      .select('test_period_id')
      .eq('assigned_to', userData.user.id)
      .not('test_period_id', 'is', null)
    if (tErr) return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })

    const periodIds = Array.from(new Set((taskRows || []).map((r: any) => r.test_period_id))) as string[]
    if (periodIds.length === 0) return NextResponse.json([], { status: 200 })

    const { data: periods, error: pErr } = await supabaseAdmin
      .from('test_periods')
      .select('id, title, start_date, end_date, grade_id')
      .in('id', periodIds)
      .is('deleted_at', null)
      .order('start_date', { ascending: false })
    if (pErr) return NextResponse.json({ error: 'Failed to fetch periods' }, { status: 500 })

    return NextResponse.json((periods || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      startDate: p.start_date,
      endDate: p.end_date,
      classId: p.grade_id,
    })))
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
