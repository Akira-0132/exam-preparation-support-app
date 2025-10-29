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
      return NextResponse.json({ error: 'grade_id is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    // Authenticate requester via Supabase access token
    const authz = req.headers.get('authorization') || ''
    const token = authz.toLowerCase().startsWith('bearer ') ? authz.slice(7) : ''
    if (!token) {
      return NextResponse.json({ error: 'Missing bearer token' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }
    const teacherId = userData.user.id

    // Ensure requester is a teacher
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', teacherId)
      .single()
    if (profErr || !profile || profile.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
    }

    // Authorization: teacher role is sufficient (prototype). TODO: tighten with school-level ACL.

    // Fetch students in the grade
    const { data: students, error: stErr } = await supabaseAdmin
      .from('user_profiles')
      .select('id, display_name, student_number')
      .eq('role', 'student')
      .eq('grade_id', gradeId)
      .order('student_number', { ascending: true, nullsFirst: false })

    if (stErr) {
      return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }

    return NextResponse.json(
      (students || []).map(s => ({
        id: s.id,
        displayName: s.display_name,
        studentNumber: s.student_number ?? undefined,
      })),
      { status: 200, headers: { 'Cache-Control': 'private, max-age=60' } },
    )
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}


