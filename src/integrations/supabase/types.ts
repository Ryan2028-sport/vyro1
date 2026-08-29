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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      band_debug_snapshots: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          payload: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          avg_value: number | null
          created_at: string
          day: string
          last_recorded_at: string | null
          last_value: number | null
          max_value: number | null
          metric: string
          min_value: number | null
          sample_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_value?: number | null
          created_at?: string
          day: string
          last_recorded_at?: string | null
          last_value?: number | null
          max_value?: number | null
          metric: string
          min_value?: number | null
          sample_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_value?: number | null
          created_at?: string
          day?: string
          last_recorded_at?: string | null
          last_value?: number | null
          max_value?: number | null
          metric?: string
          min_value?: number | null
          sample_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      debug_access_allowlist: {
        Row: {
          created_at: string
          identifier: string
          note: string | null
        }
        Insert: {
          created_at?: string
          identifier: string
          note?: string | null
        }
        Update: {
          created_at?: string
          identifier?: string
          note?: string | null
        }
        Relationships: []
      }
      metric_samples: {
        Row: {
          created_at: string
          extra: Json | null
          id: number
          metric: string
          recorded_at: string
          unit: string | null
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          extra?: Json | null
          id?: number
          metric: string
          recorded_at?: string
          unit?: string | null
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          extra?: Json | null
          id?: number
          metric?: string
          recorded_at?: string
          unit?: string | null
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          handedness: string
          id: string
          paired_band_id: string | null
          paired_band_name: string | null
          sport: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          handedness?: string
          id: string
          paired_band_id?: string | null
          paired_band_name?: string | null
          sport?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          handedness?: string
          id?: string
          paired_band_id?: string | null
          paired_band_name?: string | null
          sport?: string
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          burst_count: number
          created_at: string
          dir_change_count: number
          ended_at: string | null
          id: string
          rapid_count: number
          sport: string
          started_at: string
          summary: Json | null
          swing_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          burst_count?: number
          created_at?: string
          dir_change_count?: number
          ended_at?: string | null
          id?: string
          rapid_count?: number
          sport: string
          started_at?: string
          summary?: Json | null
          swing_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          burst_count?: number
          created_at?: string
          dir_change_count?: number
          ended_at?: string | null
          id?: string
          rapid_count?: number
          sport?: string
          started_at?: string
          summary?: Json | null
          swing_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sleep_nights: {
        Row: {
          asleep_min: number
          created_at: string
          day: string
          debt_min: number | null
          end_at: string
          hypnogram: Json | null
          id: string
          in_bed_min: number
          score: number
          stages: Json | null
          updated_at: string
          user_id: string
          wakeups: number
        }
        Insert: {
          asleep_min: number
          created_at?: string
          day: string
          debt_min?: number | null
          end_at: string
          hypnogram?: Json | null
          id?: string
          in_bed_min: number
          score: number
          stages?: Json | null
          updated_at?: string
          user_id: string
          wakeups?: number
        }
        Update: {
          asleep_min?: number
          created_at?: string
          day?: string
          debt_min?: number | null
          end_at?: string
          hypnogram?: Json | null
          id?: string
          in_bed_min?: number
          score?: number
          stages?: Json | null
          updated_at?: string
          user_id?: string
          wakeups?: number
        }
        Relationships: []
      }
      training_plan_items: {
        Row: {
          created_at: string
          day: string
          id: string
          load_label: string
          sport: string | null
          time_label: string
          title: string
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: string
          id?: string
          load_label?: string
          sport?: string | null
          time_label?: string
          title: string
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          load_label?: string
          sport?: string | null
          time_label?: string
          title?: string
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_analyses: {
        Row: {
          created_at: string
          duration_sec: number
          id: string
          insight: Json
          user_id: string
          video_name: string
        }
        Insert: {
          created_at?: string
          duration_sec?: number
          id?: string
          insight: Json
          user_id: string
          video_name: string
        }
        Update: {
          created_at?: string
          duration_sec?: number
          id?: string
          insight?: Json
          user_id?: string
          video_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "coach" | "athlete"
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
    Enums: {
      app_role: ["admin", "coach", "athlete"],
    },
  },
} as const
