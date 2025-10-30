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

    // role check and get profile with grade_id
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('user_profiles')
      .select('role, grade_id')
      .eq('id', userData.user.id)
      .maybeSingle()
    
    if (profileErr) {
      console.error('[by-student] Error fetching profile:', profileErr)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }
    
    if (!profile || profile.role !== 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Strategy 1: Find test periods from tasks (if tasks exist)
    const { data: taskRows, error: tErr } = await supabaseAdmin
      .from('tasks')
      .select('test_period_id')
      .eq('assigned_to', userData.user.id)
      .not('test_period_id', 'is', null)
    
    if (tErr) {
      console.error('[by-student] Error fetching tasks:', tErr)
      // Continue to Strategy 2 even if tasks fetch fails
    }

    const periodIdsFromTasks = Array.from(new Set((taskRows || []).map((r: any) => r.test_period_id))) as string[]

    // Strategy 2: Find test periods by grade_id (if grade_id exists)
    let periodIdsFromGrade: string[] = []
    if (profile.grade_id) {
      const { data: gradePeriods, error: gradeErr } = await supabaseAdmin
        .from('test_periods')
        .select('id')
        .eq('grade_id', profile.grade_id)
        .is('deleted_at', null)
      
      if (!gradeErr && gradePeriods) {
        periodIdsFromGrade = gradePeriods.map((p: any) => p.id)
      }
    }

    // Combine both strategies (remove duplicates)
    const allPeriodIds = Array.from(new Set([...periodIdsFromTasks, ...periodIdsFromGrade]))
    
    if (allPeriodIds.length === 0) {
      console.log('[by-student] No test periods found for student:', userData.user.id)
      return NextResponse.json([], { status: 200 })
    }

    // Fetch test periods
    const { data: periods, error: pErr } = await supabaseAdmin
      .from('test_periods')
      .select('id, title, start_date, end_date, grade_id')
      .in('id', allPeriodIds)
      .is('deleted_at', null)
      .order('start_date', { ascending: false })
    
    if (pErr) {
      console.error('[by-student] Error fetching periods:', pErr)
      return NextResponse.json({ error: 'Failed to fetch periods' }, { status: 500 })
    }

    return NextResponse.json((periods || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      startDate: p.start_date,
      endDate: p.end_date,
      classId: p.grade_id,
    })))
  } catch (e) {
    console.error('[by-student] Unexpected error:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
