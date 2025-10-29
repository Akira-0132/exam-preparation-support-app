import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      subject,
      priority = 'medium',
      status = 'not_started',
      dueDate,
      estimatedTime = 30,
      startDate,
      testPeriodId,
      assignedTo,
      createdBy,
      isShared = true,
    } = body || {}

    if (!title || !subject || !testPeriodId || !assignedTo || !createdBy) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 学年一致バリデーション
    const [{ data: user, error: e1 }, { data: period, error: e2 }] = await Promise.all([
      supabaseAdmin.from('user_profiles').select('id, grade_id').eq('id', assignedTo).maybeSingle(),
      supabaseAdmin.from('test_periods').select('id, grade_id').eq('id', testPeriodId).maybeSingle(),
    ])
    if (e1 || e2) {
      return NextResponse.json({ error: (e1 || e2)?.message || 'Validation failed' }, { status: 500 })
    }
    if (!user || !period) {
      return NextResponse.json({ error: 'User or period not found' }, { status: 404 })
    }
    if (user.grade_id && period.grade_id && user.grade_id !== period.grade_id) {
      return NextResponse.json({ error: 'Grade mismatch between user and test period' }, { status: 400 })
    }

    const insert = {
      title,
      description,
      subject,
      priority,
      status,
      due_date: dueDate ?? new Date().toISOString(),
      estimated_time: estimatedTime,
      start_date: startDate ?? new Date().toISOString(),
      test_period_id: testPeriodId,
      assigned_to: assignedTo,
      created_by: createdBy,
      is_shared: isShared,
      task_type: 'single' as const,
    }

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert(insert)
      .select('id')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data?.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}


