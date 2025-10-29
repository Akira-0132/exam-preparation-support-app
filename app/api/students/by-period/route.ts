import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/students/by-period?period_id=...
// Authorization: Bearer <access_token>
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodId = searchParams.get('period_id')
    if (!periodId) {
      return NextResponse.json({ error: 'period_id is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    // Auth
    const authz = req.headers.get('authorization') || ''
    const token = authz.toLowerCase().startsWith('bearer ') ? authz.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    // Teacher role only
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()
    if (profErr || !profile || profile.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Distinct students who have tasks in this period
    const { data: taskRows, error: tErr } = await supabaseAdmin
      .from('tasks')
      .select('assigned_to')
      .eq('test_period_id', periodId)
      .not('assigned_to', 'is', null)
    if (tErr) return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    const studentIds = Array.from(new Set((taskRows || []).map((r: any) => r.assigned_to))) as string[]
    if (studentIds.length === 0) return NextResponse.json([], { status: 200, headers: { 'Cache-Control': 'private, max-age=60' } })

    // Profiles
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from('user_profiles')
      .select('id, display_name, grade_id, school_id')
      .in('id', studentIds)
    if (pErr) return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })

    // Grades -> grade_number
    const gradeIds = Array.from(new Set((profiles || []).map((p: any) => p.grade_id).filter(Boolean))) as string[]
    const schoolIds = Array.from(new Set((profiles || []).map((p: any) => p.school_id).filter(Boolean))) as string[]

    const [{ data: grades }, { data: schools }] = await Promise.all([
      gradeIds.length > 0
        ? supabaseAdmin.from('grades').select('id, grade_number').in('id', gradeIds)
        : Promise.resolve({ data: [] as any[] } as any),
      schoolIds.length > 0
        ? supabaseAdmin.from('schools').select('id, name').in('id', schoolIds)
        : Promise.resolve({ data: [] as any[] } as any),
    ])

    const gradeMap = new Map<string, number>((grades || []).map((g: any) => [g.id, g.grade_number]))
    const schoolMap = new Map<string, string>((schools || []).map((s: any) => [s.id, s.name]))

    const result = (profiles || []).map((p: any) => ({
      id: p.id,
      displayName: p.display_name,
      gradeId: p.grade_id ?? null,
      gradeNumber: p.grade_id ? (gradeMap.get(p.grade_id) ?? null) : null,
      schoolId: p.school_id ?? null,
      schoolName: p.school_id ? (schoolMap.get(p.school_id) ?? null) : null,
    }))

    return NextResponse.json(result, { status: 200, headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}


