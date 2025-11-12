// This file contains the database type definitions for Supabase
// These types can be generated using: npx supabase gen types typescript --project-id YOUR_PROJECT_ID

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          name: string | null
          role: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email?: string | null
          name?: string | null
          role?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          name?: string | null
          role?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      lifters: {
        Row: {
          lifter_id: number
          athlete_name: string | null
          membership_number: string | null
          wso: string | null
          club_name: string | null
          [key: string]: any
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
      }
      [key: string]: {
        Row: { [key: string]: any }
        Insert: { [key: string]: any }
        Update: { [key: string]: any }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
