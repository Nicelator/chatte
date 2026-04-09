import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function getUserId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('chatte_uid')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('chatte_uid', id)
  }
  return id
}

export type Gender = 'male' | 'female' | 'any'

export interface Room {
  id: string
  user_a: string
  user_b: string
}
