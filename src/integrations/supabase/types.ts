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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          driver_visible: boolean
          expenses_visible: boolean
          id: boolean
          statement_visible: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_visible?: boolean
          expenses_visible?: boolean
          id?: boolean
          statement_visible?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_visible?: boolean
          expenses_visible?: boolean
          id?: boolean
          statement_visible?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          bill_no: string | null
          category: string
          created_at: string
          created_by: string | null
          expense_date: string
          id: string
          notes: string | null
          vendor: string
        }
        Insert: {
          amount: number
          bill_no?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          expense_date: string
          id?: string
          notes?: string | null
          vendor: string
        }
        Update: {
          amount?: number
          bill_no?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          vendor?: string
        }
        Relationships: []
      }
      monthly_fee_config: {
        Row: {
          created_at: string
          higher_amount: number
          id: string
          lower_amount: number
          period: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          higher_amount: number
          id?: string
          lower_amount: number
          period: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          higher_amount?: number
          id?: string
          lower_amount?: number
          period?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          base_amount: number
          id: string
          mode: Database["public"]["Enums"]["payment_mode"]
          paid_at: string
          penalty_amount: number
          period: string
          receipt_no: string
          recorded_by: string | null
          reference: string | null
          stage: Database["public"]["Enums"]["penalty_stage"]
          student_id: string
          total_amount: number
          value_date: string
        }
        Insert: {
          base_amount: number
          id?: string
          mode: Database["public"]["Enums"]["payment_mode"]
          paid_at?: string
          penalty_amount?: number
          period: string
          receipt_no: string
          recorded_by?: string | null
          reference?: string | null
          stage: Database["public"]["Enums"]["penalty_stage"]
          student_id: string
          total_amount: number
          value_date?: string
        }
        Update: {
          base_amount?: number
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          paid_at?: string
          penalty_amount?: number
          period?: string
          receipt_no?: string
          recorded_by?: string | null
          reference?: string | null
          stage?: Database["public"]["Enums"]["penalty_stage"]
          student_id?: string
          total_amount?: number
          value_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_counters: {
        Row: {
          last_no: number
          period: string
          updated_at: string
        }
        Insert: {
          last_no?: number
          period: string
          updated_at?: string
        }
        Update: {
          last_no?: number
          period?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          address: string | null
          application_no: number
          blacklist_reason: string | null
          blacklisted: boolean
          boarding_point: string | null
          branch: string | null
          created_at: string
          date_of_joining: string | null
          email: string | null
          full_name: string
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          phone: string | null
          photo_path: string | null
          pickup_seq: number | null
          rejection_reason: string | null
          roll_number: string | null
          slab: Database["public"]["Enums"]["fee_slab"]
          stage: Database["public"]["Enums"]["bus_stage"]
          status: Database["public"]["Enums"]["reg_status"]
          updated_at: string
          user_id: string | null
          year_of_study: string | null
        }
        Insert: {
          address?: string | null
          application_no?: number
          blacklist_reason?: string | null
          blacklisted?: boolean
          boarding_point?: string | null
          branch?: string | null
          created_at?: string
          date_of_joining?: string | null
          email?: string | null
          full_name: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          phone?: string | null
          photo_path?: string | null
          pickup_seq?: number | null
          rejection_reason?: string | null
          roll_number?: string | null
          slab?: Database["public"]["Enums"]["fee_slab"]
          stage?: Database["public"]["Enums"]["bus_stage"]
          status?: Database["public"]["Enums"]["reg_status"]
          updated_at?: string
          user_id?: string | null
          year_of_study?: string | null
        }
        Update: {
          address?: string | null
          application_no?: number
          blacklist_reason?: string | null
          blacklisted?: boolean
          boarding_point?: string | null
          branch?: string | null
          created_at?: string
          date_of_joining?: string | null
          email?: string | null
          full_name?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          phone?: string | null
          photo_path?: string | null
          pickup_seq?: number | null
          rejection_reason?: string | null
          roll_number?: string | null
          slab?: Database["public"]["Enums"]["fee_slab"]
          stage?: Database["public"]["Enums"]["bus_stage"]
          status?: Database["public"]["Enums"]["reg_status"]
          updated_at?: string
          user_id?: string | null
          year_of_study?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      claim_admin: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_receipt_no: { Args: { _period: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "student" | "driver"
      bus_stage: "Stage-1" | "Stage-2" | "Stage-3"
      fee_slab: "lower" | "higher"
      payment_mode: "cash" | "upi" | "bank"
      penalty_stage: "on_time" | "fine" | "superfine" | "blacklisted"
      reg_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "student", "driver"],
      bus_stage: ["Stage-1", "Stage-2", "Stage-3"],
      fee_slab: ["lower", "higher"],
      payment_mode: ["cash", "upi", "bank"],
      penalty_stage: ["on_time", "fine", "superfine", "blacklisted"],
      reg_status: ["pending", "approved", "rejected"],
    },
  },
} as const
