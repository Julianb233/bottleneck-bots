'use client'

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase'

// Client-side Supabase client for use in React components
let supabaseClient: SupabaseClient<Database> | null = null

// Check if we're in a build environment without real env vars
const isBuildTime = typeof window === 'undefined' &&
  (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === '')

export function createClientComponentClient(): SupabaseClient<Database> {
  if (supabaseClient) {
    return supabaseClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'placeholder-key'

  // Only throw at runtime if not configured (not during build)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && typeof window !== 'undefined') {
    console.warn('Supabase not configured - auth features will not work')
  }

  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return supabaseClient
}

// Re-export for convenience
export { createClientComponentClient as createBrowserClient }
