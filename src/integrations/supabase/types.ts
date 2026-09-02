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
      advance_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          kind: string
          mode: Database["public"]["Enums"]["payment_mode"]
          note: string | null
          student_id: string
          txn_no: string | null
          voided_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          kind: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          note?: string | null
          student_id: string
          txn_no?: string | null
          voided_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          kind?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          note?: string | null
          student_id?: string
          txn_no?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advance_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          advance_visible: boolean
          created_at: string
          driver_visible: boolean
          expenses_visible: boolean
          id: boolean
          statement_visible: boolean
          updated_at: string
        }
        Insert: {
          advance_visible?: boolean
          created_at?: string
          driver_visible?: boolean
          expenses_visible?: boolean
          id?: boolean
          statement_visible?: boolean
          updated_at?: string
        }
        Update: {
          advance_visible?: boolean
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
          txn_no: string | null
          vendor: string
          voided_at: string | null
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
          txn_no?: string | null
          vendor: string
          voided_at?: string | null
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
          txn_no?: string | null
          vendor?: string
          voided_at?: string | null
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
      other_income: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          income_date: string
          particulars: string
          remarks: string | null
          txn_no: string | null
          voided_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          income_date: string
          particulars: string
          remarks?: string | null
          txn_no?: string | null
          voided_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          income_date?: string
          particulars?: string
          remarks?: string | null
          txn_no?: string | null
          voided_at?: string | null
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
          settled: boolean
          stage: Database["public"]["Enums"]["penalty_stage"]
          student_id: string
          total_amount: number
          txn_no: string | null
          value_date: string
          voided_at: string | null
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
          settled?: boolean
          stage: Database["public"]["Enums"]["penalty_stage"]
          student_id: string
          total_amount: number
          txn_no?: string | null
          value_date?: string
          voided_at?: string | null
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
          settled?: boolean
          stage?: Database["public"]["Enums"]["penalty_stage"]
          student_id?: string
          total_amount?: number
          txn_no?: string | null
          value_date?: string
          voided_at?: string | null
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
          advance_amount: number
          advance_limit: number
          advance_returned_amount: number | null
          advance_returned_at: string | null
          application_no: number
          blacklist_reason: string | null
          blacklisted: boolean
          boarding_point: string | null
          branch: string | null
          closed_at: string | null
          created_at: string
          date_of_joining: string | null
          email: string | null
          fine_amount: number
          frozen_at: string | null
          full_name: string
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          phone: string | null
          photo_path: string | null
          pickup_seq: number | null
          rejection_reason: string | null
          roll_number: string | null
          settlement_amount: number | null
          slab: Database["public"]["Enums"]["fee_slab"]
          stage: Database["public"]["Enums"]["bus_stage"]
          status: Database["public"]["Enums"]["reg_status"]
          superfine_amount: number
          updated_at: string
          user_id: string | null
          year_of_study: string | null
        }
        Insert: {
          address?: string | null
          advance_amount?: number
          advance_limit?: number
          advance_returned_amount?: number | null
          advance_returned_at?: string | null
          application_no?: number
          blacklist_reason?: string | null
          blacklisted?: boolean
          boarding_point?: string | null
          branch?: string | null
          closed_at?: string | null
          created_at?: string
          date_of_joining?: string | null
          email?: string | null
          fine_amount?: number
          frozen_at?: string | null
          full_name: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          phone?: string | null
          photo_path?: string | null
          pickup_seq?: number | null
          rejection_reason?: string | null
          roll_number?: string | null
          settlement_amount?: number | null
          slab?: Database["public"]["Enums"]["fee_slab"]
          stage?: Database["public"]["Enums"]["bus_stage"]
          status?: Database["public"]["Enums"]["reg_status"]
          superfine_amount?: number
          updated_at?: string
          user_id?: string | null
          year_of_study?: string | null
        }
        Update: {
          address?: string | null
          advance_amount?: number
          advance_limit?: number
          advance_returned_amount?: number | null
          advance_returned_at?: string | null
          application_no?: number
          blacklist_reason?: string | null
          blacklisted?: boolean
          boarding_point?: string | null
          branch?: string | null
          closed_at?: string | null
          created_at?: string
          date_of_joining?: string | null
          email?: string | null
          fine_amount?: number
          frozen_at?: string | null
          full_name?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          phone?: string | null
          photo_path?: string | null
          pickup_seq?: number | null
          rejection_reason?: string | null
          roll_number?: string | null
          settlement_amount?: number | null
          slab?: Database["public"]["Enums"]["fee_slab"]
          stage?: Database["public"]["Enums"]["bus_stage"]
          status?: Database["public"]["Enums"]["reg_status"]
          superfine_amount?: number
          updated_at?: string
          user_id?: string | null
          year_of_study?: string | null
        }
        Relationships: []
      }
      transaction_counters: {
        Row: {
          day: string
          last_no: number
          updated_at: string
        }
        Insert: {
          day: string
          last_no?: number
          updated_at?: string
        }
        Update: {
          day?: string
          last_no?: number
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          note: string | null
          txn_date: string
          txn_no: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          note?: string | null
          txn_date: string
          txn_no: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note?: string | null
          txn_date?: string
          txn_no?: string
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
      next_txn_no: { Args: { _day: string }; Returns: string }
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
