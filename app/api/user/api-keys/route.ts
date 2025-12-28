import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateApiKey, hashApiKey } from '@/lib/api-keys'

export async function GET() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('api_keys')
    .select('id, name, prefix, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  const apiKey = generateApiKey()
  
  const { data } = await supabase
    .from('api_keys')
    .insert({ user_id: user.id, name, key_hash: hashApiKey(apiKey), prefix: apiKey.slice(0, 10) })
    .select('id, name, prefix')
    .single()

  return NextResponse.json({ ...data, key: apiKey }, { status: 201 })
}
