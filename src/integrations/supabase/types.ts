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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admission_documents: {
        Row: {
          admission_type: string
          content: string
          content_type: string
          created_at: string | null
          document_type: string
          embedding: string | null
          id: string
          source_file: string | null
          university: string
          year: number
        }
        Insert: {
          admission_type?: string
          content?: string
          content_type?: string
          created_at?: string | null
          document_type?: string
          embedding?: string | null
          id?: string
          source_file?: string | null
          university?: string
          year?: number
        }
        Update: {
          admission_type?: string
          content?: string
          content_type?: string
          created_at?: string | null
          document_type?: string
          embedding?: string | null
          id?: string
          source_file?: string | null
          university?: string
          year?: number
        }
        Relationships: []
      }
      admission_plans: {
        Row: {
          admission_category: string
          admission_type: string
          created_at: string | null
          id: string
          reflected_subjects: Json | null
          selection_method: string
          special_notes: string | null
          subject_recommendation_applied: boolean
          subject_recommendation_note: string | null
          suneung_minimum: boolean
          suneung_minimum_detail: string | null
          university: string
          year: number
        }
        Insert: {
          admission_category?: string
          admission_type?: string
          created_at?: string | null
          id?: string
          reflected_subjects?: Json | null
          selection_method?: string
          special_notes?: string | null
          subject_recommendation_applied?: boolean
          subject_recommendation_note?: string | null
          suneung_minimum?: boolean
          suneung_minimum_detail?: string | null
          university?: string
          year?: number
        }
        Update: {
          admission_category?: string
          admission_type?: string
          created_at?: string | null
          id?: string
          reflected_subjects?: Json | null
          selection_method?: string
          special_notes?: string | null
          subject_recommendation_applied?: boolean
          subject_recommendation_note?: string | null
          suneung_minimum?: boolean
          suneung_minimum_detail?: string | null
          university?: string
          year?: number
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string
          created_at: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: never
          metadata?: Json | null
        }
        Update: {
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: never
          metadata?: Json | null
        }
        Relationships: []
      }
      subject_descriptions: {
        Row: {
          category: string
          content: string
          created_at: string | null
          embedding: string | null
          id: number
          metadata: Json | null
          subject_name: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: never
          metadata?: Json | null
          subject_name?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: never
          metadata?: Json | null
          subject_name?: string
        }
        Relationships: []
      }
      university_courses: {
        Row: {
          area: string
          college: string | null
          core_subjects: string | null
          department: string | null
          id: string
          notes: string | null
          recommended_subjects: string | null
          region: string
          university: string
        }
        Insert: {
          area?: string
          college?: string | null
          core_subjects?: string | null
          department?: string | null
          id?: string
          notes?: string | null
          recommended_subjects?: string | null
          region?: string
          university?: string
        }
        Update: {
          area?: string
          college?: string | null
          core_subjects?: string | null
          department?: string | null
          id?: string
          notes?: string | null
          recommended_subjects?: string | null
          region?: string
          university?: string
        }
        Relationships: []
      }
      university_subjects: {
        Row: {
          city: string
          created_at: string | null
          department: string
          id: string
          is_core: boolean
          is_recommended: boolean
          region: string
          subject: string
          university: string
          year: number
        }
        Insert: {
          city?: string
          created_at?: string | null
          department?: string
          id?: string
          is_core?: boolean
          is_recommended?: boolean
          region?: string
          subject?: string
          university?: string
          year?: number
        }
        Update: {
          city?: string
          created_at?: string | null
          department?: string
          id?: string
          is_core?: boolean
          is_recommended?: boolean
          region?: string
          subject?: string
          university?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_documents: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      match_subject_descriptions: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          id: number
          metadata: Json
          similarity: number
          subject_name: string
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
