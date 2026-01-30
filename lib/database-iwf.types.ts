export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      iwf_lifters: {
        Row: {
          athlete_name: string
          birth_year: number | null
          country_code: string | null
          country_name: string | null
          created_at: string | null
          db_lifter_id: number
          gender: string | null
          iwf_athlete_url: string | null
          iwf_lifter_id: number | null
          updated_at: string | null
        }
        Insert: {
          athlete_name: string
          birth_year?: number | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string | null
          db_lifter_id?: number
          gender?: string | null
          iwf_athlete_url?: string | null
          iwf_lifter_id?: number | null
          updated_at?: string | null
        }
        Update: {
          athlete_name?: string
          birth_year?: number | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string | null
          db_lifter_id?: number
          gender?: string | null
          iwf_athlete_url?: string | null
          iwf_lifter_id?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      iwf_meet_locations: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          date_range: string | null
          db_location_id: number
          iwf_meet_id: string
          latitude: number | null
          location_text: string | null
          longitude: number | null
          updated_at: string | null
          venue_name: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_range?: string | null
          db_location_id?: number
          iwf_meet_id: string
          latitude?: number | null
          location_text?: string | null
          longitude?: number | null
          updated_at?: string | null
          venue_name?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_range?: string | null
          db_location_id?: number
          iwf_meet_id?: string
          latitude?: number | null
          location_text?: string | null
          longitude?: number | null
          updated_at?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iwf_meet_locations_iwf_meet_id_fkey"
            columns: ["iwf_meet_id"]
            isOneToOne: true
            referencedRelation: "iwf_meets"
            referencedColumns: ["iwf_meet_id"]
          },
        ]
      }
      iwf_meet_results: {
        Row: {
          age_category: string | null
          best_cj: string | null
          best_cj_ytd: number | null
          best_snatch: string | null
          best_snatch_ytd: number | null
          best_total_ytd: number | null
          birth_year: number | null
          body_weight_kg: string | null
          bounce_back_cj_2: boolean | null
          bounce_back_cj_3: boolean | null
          bounce_back_snatch_2: boolean | null
          bounce_back_snatch_3: boolean | null
          cj_lift_1: string | null
          cj_lift_2: string | null
          cj_lift_3: string | null
          cj_successful_attempts: number | null
          competition_age: number | null
          competition_group: string | null
          country_code: string | null
          country_name: string | null
          created_at: string | null
          date: string | null
          db_lifter_id: number
          db_meet_id: number | null
          db_result_id: number
          gamx_a: number | null
          gamx_j: number | null
          gamx_masters: number | null
          gamx_s: number | null
          gamx_total: number | null
          gamx_u: number | null
          gender: string | null
          lifter_name: string | null
          manual_override: boolean | null
          meet_name: string | null
          q_masters: number | null
          q_youth: number | null
          qpoints: number | null
          rank: number | null
          snatch_lift_1: string | null
          snatch_lift_2: string | null
          snatch_lift_3: string | null
          snatch_successful_attempts: number | null
          total: string | null
          total_successful_attempts: number | null
          updated_at: string | null
          weight_class: string | null
        }
        Insert: {
          age_category?: string | null
          best_cj?: string | null
          best_cj_ytd?: number | null
          best_snatch?: string | null
          best_snatch_ytd?: number | null
          best_total_ytd?: number | null
          birth_year?: number | null
          body_weight_kg?: string | null
          bounce_back_cj_2?: boolean | null
          bounce_back_cj_3?: boolean | null
          bounce_back_snatch_2?: boolean | null
          bounce_back_snatch_3?: boolean | null
          cj_lift_1?: string | null
          cj_lift_2?: string | null
          cj_lift_3?: string | null
          cj_successful_attempts?: number | null
          competition_age?: number | null
          competition_group?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string | null
          date?: string | null
          db_lifter_id: number
          db_meet_id?: number | null
          db_result_id?: number
          gamx_a?: number | null
          gamx_j?: number | null
          gamx_masters?: number | null
          gamx_s?: number | null
          gamx_total?: number | null
          gamx_u?: number | null
          gender?: string | null
          lifter_name?: string | null
          manual_override?: boolean | null
          meet_name?: string | null
          q_masters?: number | null
          q_youth?: number | null
          qpoints?: number | null
          rank?: number | null
          snatch_lift_1?: string | null
          snatch_lift_2?: string | null
          snatch_lift_3?: string | null
          snatch_successful_attempts?: number | null
          total?: string | null
          total_successful_attempts?: number | null
          updated_at?: string | null
          weight_class?: string | null
        }
        Update: {
          age_category?: string | null
          best_cj?: string | null
          best_cj_ytd?: number | null
          best_snatch?: string | null
          best_snatch_ytd?: number | null
          best_total_ytd?: number | null
          birth_year?: number | null
          body_weight_kg?: string | null
          bounce_back_cj_2?: boolean | null
          bounce_back_cj_3?: boolean | null
          bounce_back_snatch_2?: boolean | null
          bounce_back_snatch_3?: boolean | null
          cj_lift_1?: string | null
          cj_lift_2?: string | null
          cj_lift_3?: string | null
          cj_successful_attempts?: number | null
          competition_age?: number | null
          competition_group?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string | null
          date?: string | null
          db_lifter_id?: number
          db_meet_id?: number | null
          db_result_id?: number
          gamx_a?: number | null
          gamx_j?: number | null
          gamx_masters?: number | null
          gamx_s?: number | null
          gamx_total?: number | null
          gamx_u?: number | null
          gender?: string | null
          lifter_name?: string | null
          manual_override?: boolean | null
          meet_name?: string | null
          q_masters?: number | null
          q_youth?: number | null
          qpoints?: number | null
          rank?: number | null
          snatch_lift_1?: string | null
          snatch_lift_2?: string | null
          snatch_lift_3?: string | null
          snatch_successful_attempts?: number | null
          total?: string | null
          total_successful_attempts?: number | null
          updated_at?: string | null
          weight_class?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iwf_meet_results_db_lifter_id_fkey"
            columns: ["db_lifter_id"]
            isOneToOne: false
            referencedRelation: "iwf_lifters"
            referencedColumns: ["db_lifter_id"]
          },
          {
            foreignKeyName: "iwf_meet_results_db_meet_id_fkey"
            columns: ["db_meet_id"]
            isOneToOne: false
            referencedRelation: "iwf_meets"
            referencedColumns: ["db_meet_id"]
          },
        ]
      }
      iwf_meets: {
        Row: {
          batch_id: string | null
          created_at: string | null
          date: string | null
          db_meet_id: number
          iwf_meet_id: string
          level: string | null
          meet: string | null
          results: number | null
          scraped_date: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          date?: string | null
          db_meet_id?: number
          iwf_meet_id: string
          level?: string | null
          meet?: string | null
          results?: number | null
          scraped_date?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          date?: string | null
          db_meet_id?: number
          iwf_meet_id?: string
          level?: string | null
          meet?: string | null
          results?: number | null
          scraped_date?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      youth_factors: {
        Row: {
          age: number | null
          bodyweight_kg: number | null
          factor: number | null
          gender: string | null
          id: number
        }
        Insert: {
          age?: number | null
          bodyweight_kg?: number | null
          factor?: number | null
          gender?: string | null
          id: number
        }
        Update: {
          age?: number | null
          bodyweight_kg?: number | null
          factor?: number | null
          gender?: string | null
          id?: number
        }
        Relationships: []
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
