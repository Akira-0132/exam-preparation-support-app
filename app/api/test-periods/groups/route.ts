import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/test-periods/groups
// Authorization: Bearer <access_token> (teacher)
export async function GET(req: NextRequest) {
  try {
    const authz = req.headers.get('authorization') || ''
    const token = authz.toLowerCase().startsWith('bearer ') ? authz.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const { data: profile, error: profErr } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()
    if (profErr || !profile || profile.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('test_periods')
      .select('id, title, start_date, grade_id')
      .is('deleted_at', null)
      .order('start_date', { ascending: false })

    if (error) return NextResponse.json({ error: 'Failed to fetch test periods' }, { status: 500 })

    return NextResponse.json((data || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      startDate: p.start_date,
      classId: p.grade_id,
    })), { status: 200, headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
