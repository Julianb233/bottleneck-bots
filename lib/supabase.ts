import { createClient, SupabaseClient } from "@supabase/supabase-js"

// Supabase client configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || ''

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseKey)
}

// Create client only if configured (avoids build-time errors)
let _supabase: SupabaseClient | null = null

export const supabase = (() => {
  if (!_supabase && supabaseUrl && supabaseKey) {
    _supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true },
    })
  }
  return _supabase as SupabaseClient
})()

// Server-side client with service role (for admin operations)
export const getServerSupabase = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return supabase // Fall back to anon client
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  })
}

// Database type definitions
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          name?: string | null
          updated_at?: string
        }
      }
      bots: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          config: Record<string, unknown>
          status: "active" | "paused" | "stopped"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          config?: Record<string, unknown>
          status?: "active" | "paused" | "stopped"
        }
        Update: {
          name?: string
          description?: string | null
          config?: Record<string, unknown>
          status?: "active" | "paused" | "stopped"
          updated_at?: string
        }
      }
      bot_runs: {
        Row: {
          id: string
          bot_id: string
          status: "pending" | "running" | "completed" | "failed"
          started_at: string
          completed_at: string | null
          result: Record<string, unknown> | null
          error: string | null
        }
        Insert: {
          id?: string
          bot_id: string
          status?: "pending" | "running" | "completed" | "failed"
          started_at?: string
        }
        Update: {
          status?: "pending" | "running" | "completed" | "failed"
          completed_at?: string | null
          result?: Record<string, unknown> | null
          error?: string | null
        }
      }
    }
  }
}

// Typed Supabase client (use supabase instead for most operations)
export const db = supabase
