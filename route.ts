import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Gender } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { user_id, gender, wants } = await req.json() as {
    user_id: string
    gender: Gender
    wants: Gender
  }

  await supabase.from('waiting_users').delete().eq('user_id', user_id)

  const matchQuery = supabase
    .from('waiting_users')
    .select('*')
    .neq('user_id', user_id)
    .order('joined_at', { ascending: true })
    .limit(1)

  if (wants !== 'any') {
    matchQuery.eq('gender', wants)
  }

  const { data: candidates } = await matchQuery

  const match = candidates?.find(c =>
    c.wants === 'any' || c.wants === gender
  )

  if (match) {
    const { data: room, error } = await supabase
      .from('rooms')
      .insert({ user_a: match.user_id, user_b: user_id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('waiting_users').delete().eq('user_id', match.user_id)

    return NextResponse.json({ matched: true, room })
  }

  const { error: insertError } = await supabase
    .from('waiting_users')
    .insert({ user_id, gender, wants })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ matched: false, waiting: true })
}

export async function DELETE(req: NextRequest) {
  const { user_id } = await req.json()
  await supabase.from('waiting_users').delete().eq('user_id', user_id)
  return NextResponse.json({ ok: true })
}
