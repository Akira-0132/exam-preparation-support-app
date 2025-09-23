import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/students/by-grade?grade_id=...&period_id=...
// Authorization: Bearer <access_token>

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const gradeId = searchParams.get('grade_id')
    const periodId = searchParams.get('period_id')

    if (!gradeId) {
      return NextResponse.json({ error: 'grade_id is required' }, { status: 400 })
    }

    // Authenticate requester via Supabase access token
    const authz = req.headers.get('authorization') || ''
    const token = authz.toLowerCase().startsWith('bearer ') ? authz.slice(7) : ''
    if (!token) {
      return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const teacherId = userData.user.id

    // Ensure requester is a teacher
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', teacherId)
      .single()
    if (profErr || !profile || profile.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Authorization: requester must be creator of a test_period for this grade
    let authOk = false
    if (periodId) {
      const { data: tp, error: tpErr } = await supabaseAdmin
        .from('test_periods')
        .select('id, grade_id, created_by')
        .eq('id', periodId)
        .eq('created_by', teacherId)
        .eq('grade_id', gradeId)
        .maybeSingle()
      authOk = !!tp && !tpErr
    } else {
      const { data: tps, error: tpsErr } = await supabaseAdmin
        .from('test_periods')
        .select('id')
        .eq('created_by', teacherId)
        .eq('grade_id', gradeId)
        .limit(1)
      authOk = !!tps && tps.length > 0 && !tpsErr
    }

    if (!authOk) {
      return NextResponse.json({ error: 'Not authorized for this grade' }, { status: 403 })
    }

    // Fetch students in the grade
    const { data: students, error: stErr } = await supabaseAdmin
      .from('user_profiles')
      .select('id, display_name, student_number')
      .eq('role', 'student')
      .eq('grade_id', gradeId)
      .order('student_number', { ascending: true, nullsFirst: false })

    if (stErr) {
      return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
    }

    return NextResponse.json(
      (students || []).map(s => ({
        id: s.id,
        displayName: s.display_name,
        studentNumber: s.student_number ?? undefined,
      })),
      { status: 200 },
    )
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}


