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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      usaw_club_rolling_metrics: {
        Row: {
          active_members_12mo: number | null
          activity_factor: number | null
          calculated_at: string | null
          club_name: string
          id: number
          snapshot_month: string
          total_competitions_12mo: number | null
          unique_lifters_12mo: number | null
        }
        Insert: {
          active_members_12mo?: number | null
          activity_factor?: number | null
          calculated_at?: string | null
          club_name: string
          id?: number
          snapshot_month: string
          total_competitions_12mo?: number | null
          unique_lifters_12mo?: number | null
        }
        Update: {
          active_members_12mo?: number | null
          activity_factor?: number | null
          calculated_at?: string | null
          club_name?: string
          id?: number
          snapshot_month?: string
          total_competitions_12mo?: number | null
          unique_lifters_12mo?: number | null
        }
        Relationships: []
      }
      usaw_clubs: {
        Row: {
          active_lifters_count: number | null
          activity_factor: number | null
          address: string | null
          analytics_updated_at: string | null
          club_name: string
          created_at: string | null
          elevation_fetched_at: string | null
          elevation_meters: number | null
          elevation_source: string | null
          email: string | null
          geocode_display_name: string | null
          geocode_error: string | null
          geocode_precision_score: number | null
          geocode_strategy_used: string | null
          geocode_success: boolean | null
          latitude: number | null
          longitude: number | null
          phone: string | null
          recent_meets_count: number | null
          state: string | null
          total_participations: number | null
          updated_at: string | null
          wso_geography: string | null
        }
        Insert: {
          active_lifters_count?: number | null
          activity_factor?: number | null
          address?: string | null
          analytics_updated_at?: string | null
          club_name: string
          created_at?: string | null
          elevation_fetched_at?: string | null
          elevation_meters?: number | null
          elevation_source?: string | null
          email?: string | null
          geocode_display_name?: string | null
          geocode_error?: string | null
          geocode_precision_score?: number | null
          geocode_strategy_used?: string | null
          geocode_success?: boolean | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          recent_meets_count?: number | null
          state?: string | null
          total_participations?: number | null
          updated_at?: string | null
          wso_geography?: string | null
        }
        Update: {
          active_lifters_count?: number | null
          activity_factor?: number | null
          address?: string | null
          analytics_updated_at?: string | null
          club_name?: string
          created_at?: string | null
          elevation_fetched_at?: string | null
          elevation_meters?: number | null
          elevation_source?: string | null
          email?: string | null
          geocode_display_name?: string | null
          geocode_error?: string | null
          geocode_precision_score?: number | null
          geocode_strategy_used?: string | null
          geocode_success?: boolean | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          recent_meets_count?: number | null
          state?: string | null
          total_participations?: number | null
          updated_at?: string | null
          wso_geography?: string | null
        }
        Relationships: []
      }
      usaw_lifters: {
        Row: {
          athlete_name: string
          club_name: string | null
          created_at: string | null
          internal_id: number | null
          internal_id_2: number | null
          internal_id_3: number | null
          internal_id_4: number | null
          internal_id_5: number | null
          internal_id_6: number | null
          internal_id_7: number | null
          internal_id_8: number | null
          lifter_id: number
          membership_number: number | null
          national_rank: number | null
          updated_at: string | null
          wso: string | null
        }
        Insert: {
          athlete_name: string
          club_name?: string | null
          created_at?: string | null
          internal_id?: number | null
          internal_id_2?: number | null
          internal_id_3?: number | null
          internal_id_4?: number | null
          internal_id_5?: number | null
          internal_id_6?: number | null
          internal_id_7?: number | null
          internal_id_8?: number | null
          lifter_id?: number
          membership_number?: number | null
          national_rank?: number | null
          updated_at?: string | null
          wso?: string | null
        }
        Update: {
          athlete_name?: string
          club_name?: string | null
          created_at?: string | null
          internal_id?: number | null
          internal_id_2?: number | null
          internal_id_3?: number | null
          internal_id_4?: number | null
          internal_id_5?: number | null
          internal_id_6?: number | null
          internal_id_7?: number | null
          internal_id_8?: number | null
          lifter_id?: number
          membership_number?: number | null
          national_rank?: number | null
          updated_at?: string | null
          wso?: string | null
        }
        Relationships: []
      }
      meet_locations: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          date_range: string | null
          elevation_fetched_at: string | null
          elevation_meters: number | null
          elevation_source: string | null
          geocode_display_name: string | null
          geocode_error: string | null
          geocode_precision_score: number | null
          geocode_success: boolean | null
          id: number
          latitude: number | null
          location_text: string | null
          longitude: number | null
          meet_id: number | null
          meet_name: string | null
          raw_address: string | null
          state: string | null
          street_address: string | null
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_range?: string | null
          elevation_fetched_at?: string | null
          elevation_meters?: number | null
          elevation_source?: string | null
          geocode_display_name?: string | null
          geocode_error?: string | null
          geocode_precision_score?: number | null
          geocode_success?: boolean | null
          id?: number
          latitude?: number | null
          location_text?: string | null
          longitude?: number | null
          meet_id?: number | null
          meet_name?: string | null
          raw_address?: string | null
          state?: string | null
          street_address?: string | null
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_range?: string | null
          elevation_fetched_at?: string | null
          elevation_meters?: number | null
          elevation_source?: string | null
          geocode_display_name?: string | null
          geocode_error?: string | null
          geocode_precision_score?: number | null
          geocode_success?: boolean | null
          id?: number
          latitude?: number | null
          location_text?: string | null
          longitude?: number | null
          meet_id?: number | null
          meet_name?: string | null
          raw_address?: string | null
          state?: string | null
          street_address?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meet_locations_meet_id_fkey"
            columns: ["meet_id"]
            isOneToOne: false
            referencedRelation: "usaw_meets"
            referencedColumns: ["meet_id"]
          },
        ]
      }
      usaw_meet_results: {
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
          club_name: string | null
          competition_age: number | null
          created_at: string | null
          date: string | null
          gender: string | null
          lifter_id: number
          lifter_name: string | null
          manual_override: boolean | null
          meet_id: number
          meet_name: string | null
          national_rank: number | null
          q_masters: number | null
          q_youth: number | null
          qpoints: number | null
          result_id: number
          snatch_lift_1: string | null
          snatch_lift_2: string | null
          snatch_lift_3: string | null
          snatch_successful_attempts: number | null
          total: string | null
          total_successful_attempts: number | null
          updated_at: string | null
          weight_class: string | null
          wso: string | null
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
          club_name?: string | null
          competition_age?: number | null
          created_at?: string | null
          date?: string | null
          gender?: string | null
          lifter_id: number
          lifter_name?: string | null
          manual_override?: boolean | null
          meet_id: number
          meet_name?: string | null
          national_rank?: number | null
          q_masters?: number | null
          q_youth?: number | null
          qpoints?: number | null
          result_id?: number
          snatch_lift_1?: string | null
          snatch_lift_2?: string | null
          snatch_lift_3?: string | null
          snatch_successful_attempts?: number | null
          total?: string | null
          total_successful_attempts?: number | null
          updated_at?: string | null
          weight_class?: string | null
          wso?: string | null
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
          club_name?: string | null
          competition_age?: number | null
          created_at?: string | null
          date?: string | null
          gender?: string | null
          lifter_id?: number
          lifter_name?: string | null
          manual_override?: boolean | null
          meet_id?: number
          meet_name?: string | null
          national_rank?: number | null
          q_masters?: number | null
          q_youth?: number | null
          qpoints?: number | null
          result_id?: number
          snatch_lift_1?: string | null
          snatch_lift_2?: string | null
          snatch_lift_3?: string | null
          snatch_successful_attempts?: number | null
          total?: string | null
          total_successful_attempts?: number | null
          updated_at?: string | null
          weight_class?: string | null
          wso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meet_results_lifter_id_fkey"
            columns: ["lifter_id"]
            isOneToOne: false
            referencedRelation: "usaw_lifters"
            referencedColumns: ["lifter_id"]
          },
          {
            foreignKeyName: "meet_results_meet_id_fkey"
            columns: ["meet_id"]
            isOneToOne: false
            referencedRelation: "usaw_meets"
            referencedColumns: ["meet_id"]
          },
        ]
      }
      usaw_meets: {
        Row: {
          address: string | null
          batch_id: string | null
          city: string | null
          country: string | null
          Date: string | null
          date_range: string | null
          elevation_fetched_at: string | null
          elevation_meters: number | null
          elevation_source: string | null
          geocode_display_name: string | null
          geocode_error: string | null
          geocode_precision_score: number | null
          geocode_strategy_used: string | null
          geocode_success: boolean | null
          latitude: number | null
          Level: string | null
          location_text: string | null
          longitude: number | null
          Meet: string
          meet_id: number
          meet_internal_id: number | null
          Results: number | null
          scraped_date: string | null
          state: string | null
          street_address: string | null
          URL: string | null
          wso_geography: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          batch_id?: string | null
          city?: string | null
          country?: string | null
          Date?: string | null
          date_range?: string | null
          elevation_fetched_at?: string | null
          elevation_meters?: number | null
          elevation_source?: string | null
          geocode_display_name?: string | null
          geocode_error?: string | null
          geocode_precision_score?: number | null
          geocode_strategy_used?: string | null
          geocode_success?: boolean | null
          latitude?: number | null
          Level?: string | null
          location_text?: string | null
          longitude?: number | null
          Meet: string
          meet_id: number
          meet_internal_id?: number | null
          Results?: number | null
          scraped_date?: string | null
          state?: string | null
          street_address?: string | null
          URL?: string | null
          wso_geography?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          batch_id?: string | null
          city?: string | null
          country?: string | null
          Date?: string | null
          date_range?: string | null
          elevation_fetched_at?: string | null
          elevation_meters?: number | null
          elevation_source?: string | null
          geocode_display_name?: string | null
          geocode_error?: string | null
          geocode_precision_score?: number | null
          geocode_strategy_used?: string | null
          geocode_success?: boolean | null
          latitude?: number | null
          Level?: string | null
          location_text?: string | null
          longitude?: number | null
          Meet?: string
          meet_id?: number
          meet_internal_id?: number | null
          Results?: number | null
          scraped_date?: string | null
          state?: string | null
          street_address?: string | null
          URL?: string | null
          wso_geography?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          name?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      usaw_wso_information: {
        Row: {
          active_lifters_count: number | null
          active_status: boolean | null
          activity_factor: number | null
          analytics_updated_at: string | null
          barbell_clubs_count: number | null
          contact_email: string | null
          counties: string[] | null
          created_at: string | null
          estimated_population: number | null
          geographic_center_lat: number | null
          geographic_center_lng: number | null
          geographic_type: string | null
          name: string
          notes: string | null
          official_url: string | null
          population_estimate: number | null
          recent_meets_count: number | null
          states: string[] | null
          territory_geojson: Json | null
          total_participations: number | null
          updated_at: string | null
          wso_id: number
        }
        Insert: {
          active_lifters_count?: number | null
          active_status?: boolean | null
          activity_factor?: number | null
          analytics_updated_at?: string | null
          barbell_clubs_count?: number | null
          contact_email?: string | null
          counties?: string[] | null
          created_at?: string | null
          estimated_population?: number | null
          geographic_center_lat?: number | null
          geographic_center_lng?: number | null
          geographic_type?: string | null
          name: string
          notes?: string | null
          official_url?: string | null
          population_estimate?: number | null
          recent_meets_count?: number | null
          states?: string[] | null
          territory_geojson?: Json | null
          total_participations?: number | null
          updated_at?: string | null
          wso_id?: number
        }
        Update: {
          active_lifters_count?: number | null
          active_status?: boolean | null
          activity_factor?: number | null
          analytics_updated_at?: string | null
          barbell_clubs_count?: number | null
          contact_email?: string | null
          counties?: string[] | null
          created_at?: string | null
          estimated_population?: number | null
          geographic_center_lat?: number | null
          geographic_center_lng?: number | null
          geographic_type?: string | null
          name?: string
          notes?: string | null
          official_url?: string | null
          population_estimate?: number | null
          recent_meets_count?: number | null
          states?: string[] | null
          territory_geojson?: Json | null
          total_participations?: number | null
          updated_at?: string | null
          wso_id?: number
        }
        Relationships: []
      }
      youth_factors: {
        Row: {
          age: number
          bodyweight_kg: number
          factor: number
          gender: string
          id: number
        }
        Insert: {
          age: number
          bodyweight_kg: number
          factor: number
          gender: string
          id?: number
        }
        Update: {
          age?: number
          bodyweight_kg?: number
          factor?: number
          gender?: string
          id?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_bounce_back: {
        Args: { current_lift: string; prev_lift: string }
        Returns: boolean
      }
      calculate_meet_result_analytics: {
        Args: {
          p_best_cj: string
          p_best_snatch: string
          p_cj_1: string
          p_cj_2: string
          p_cj_3: string
          p_date: string
          p_lifter_id: number
          p_snatch_1: string
          p_snatch_2: string
          p_snatch_3: string
          p_total: string
        }
        Returns: {
          best_cj_ytd: number
          best_snatch_ytd: number
          best_total_ytd: number
          bounce_back_cj_2: boolean
          bounce_back_cj_3: boolean
          bounce_back_snatch_2: boolean
          bounce_back_snatch_3: boolean
          cj_successful_attempts: number
          snatch_successful_attempts: number
          total_successful_attempts: number
        }[]
      }
      calculate_qpoints_from_row: {
        Args: { bodyweight: number; gender: string; total_lifted: number }
        Returns: number
      }
      calculate_ytd_best: {
        Args: {
          p_current_best: string
          p_date: string
          p_lift_type: string
          p_lifter_id: number
        }
        Returns: number
      }
      count_successful_attempts: {
        Args: { lift1: string; lift2: string; lift3: string }
        Returns: number
      }
      get_age_factor: { Args: { age: number; gender: string }; Returns: number }
      get_youth_age_factor_interpolated: {
        Args: { age: number; bodyweight: number; gender: string }
        Returns: number
      }
      get_youth_factor_exact: {
        Args: {
          input_age: number
          input_bodyweight: number
          input_gender: string
        }
        Returns: number
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      recalculate_all_qpoints: { Args: never; Returns: number }
      recalculate_lifter_analytics: {
        Args: { p_lifter_id: number; p_year?: number }
        Returns: number
      }
      search_athletes: {
        Args: { search_term: string }
        Returns: {
          athlete_name: string
          club_name: string
          gender: string
          lifter_id: number
          membership_number: string
          wso: string
        }[]
      }
      search_lifters: {
        Args: { query: string }
        Returns: {
          athlete_name: string
          club_name: string
          gender: string
          lifter_id: number
          membership_number: number
          wso: string
        }[]
      }
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
