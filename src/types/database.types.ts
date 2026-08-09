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
      account_reconciliations: {
        Row: {
          account_id: string
          actual_balance: number
          checked_date: string
          created_at: string
          difference_amount: number | null
          household_id: string
          id: string
          ledger_balance: number
          memo: string | null
        }
        Insert: {
          account_id: string
          actual_balance: number
          checked_date: string
          created_at?: string
          difference_amount?: number | null
          household_id: string
          id?: string
          ledger_balance: number
          memo?: string | null
        }
        Update: {
          account_id?: string
          actual_balance?: number
          checked_date?: string
          created_at?: string
          difference_amount?: number | null
          household_id?: string
          id?: string
          ledger_balance?: number
          memo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_reconciliations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_reconciliations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          created_at: string
          household_id: string
          id: string
          is_active: boolean
          is_living_account: boolean
          memo: string | null
          name: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          is_active?: boolean
          is_living_account?: boolean
          memo?: string | null
          name: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          is_active?: boolean
          is_living_account?: boolean
          memo?: string | null
          name?: string
          owner_type?: Database["public"]["Enums"]["owner_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          created_at: string
          household_id: string
          id: string
          is_active: boolean
          name: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          payment_account_id: string
          payment_day: number
          updated_at: string
          usage_period_note: string | null
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          is_active?: boolean
          name: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          payment_account_id: string
          payment_day: number
          updated_at?: string
          usage_period_note?: string | null
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          is_active?: boolean
          name?: string
          owner_type?: Database["public"]["Enums"]["owner_type"]
          payment_account_id?: string
          payment_day?: number
          updated_at?: string
          usage_period_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          default_account_id: string | null
          expense_summary_group:
            | Database["public"]["Enums"]["expense_summary_group"]
            | null
          household_id: string
          id: string
          income_summary_group:
            | Database["public"]["Enums"]["income_summary_group"]
            | null
          is_active: boolean
          is_asset_income: boolean | null
          name: string
          parent_id: string | null
          rate_rule_id: string | null
          sort_order: number
          suggested_expense_nature:
            | Database["public"]["Enums"]["expense_nature"]
            | null
          suggested_fund_purpose:
            | Database["public"]["Enums"]["fund_purpose"]
            | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_account_id?: string | null
          expense_summary_group?:
            | Database["public"]["Enums"]["expense_summary_group"]
            | null
          household_id: string
          id?: string
          income_summary_group?:
            | Database["public"]["Enums"]["income_summary_group"]
            | null
          is_active?: boolean
          is_asset_income?: boolean | null
          name: string
          parent_id?: string | null
          rate_rule_id?: string | null
          sort_order?: number
          suggested_expense_nature?:
            | Database["public"]["Enums"]["expense_nature"]
            | null
          suggested_fund_purpose?:
            | Database["public"]["Enums"]["fund_purpose"]
            | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_account_id?: string | null
          expense_summary_group?:
            | Database["public"]["Enums"]["expense_summary_group"]
            | null
          household_id?: string
          id?: string
          income_summary_group?:
            | Database["public"]["Enums"]["income_summary_group"]
            | null
          is_active?: boolean
          is_asset_income?: boolean | null
          name?: string
          parent_id?: string | null
          rate_rule_id?: string | null
          sort_order?: number
          suggested_expense_nature?:
            | Database["public"]["Enums"]["expense_nature"]
            | null
          suggested_fund_purpose?:
            | Database["public"]["Enums"]["fund_purpose"]
            | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_default_account_id_fkey"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_rate_rule_id_fkey"
            columns: ["rate_rule_id"]
            isOneToOne: false
            referencedRelation: "rate_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          display_name: string
          household_id: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          household_id: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          household_id?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          currency: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      monthly_snapshots: {
        Row: {
          asset_income_amount: number
          closed_at: string
          confirmed_income: number
          fixed_coverage_rate_bps: number | null
          household_id: string
          id: string
          investment_expense_amount: number
          investment_fixed_expense_amount: number
          living_account_actual_balance: number | null
          living_account_ledger_balance: number
          living_allocated_amount: number
          living_budget_balance: number
          living_expense_amount: number
          living_fixed_expense_amount: number
          snapshot_month: string
          unsettled_count: number
        }
        Insert: {
          asset_income_amount?: number
          closed_at?: string
          confirmed_income?: number
          fixed_coverage_rate_bps?: number | null
          household_id: string
          id?: string
          investment_expense_amount?: number
          investment_fixed_expense_amount?: number
          living_account_actual_balance?: number | null
          living_account_ledger_balance?: number
          living_allocated_amount?: number
          living_budget_balance?: number
          living_expense_amount?: number
          living_fixed_expense_amount?: number
          snapshot_month: string
          unsettled_count?: number
        }
        Update: {
          asset_income_amount?: number
          closed_at?: string
          confirmed_income?: number
          fixed_coverage_rate_bps?: number | null
          household_id?: string
          id?: string
          investment_expense_amount?: number
          investment_fixed_expense_amount?: number
          living_account_actual_balance?: number | null
          living_account_ledger_balance?: number
          living_allocated_amount?: number
          living_budget_balance?: number
          living_expense_amount?: number
          living_fixed_expense_amount?: number
          snapshot_month?: string
          unsettled_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_snapshots_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_rules: {
        Row: {
          created_at: string
          household_id: string
          id: string
          is_active: boolean
          memo: string | null
          name: string
          rate_bps: number
          rule_key: string
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          is_active?: boolean
          memo?: string | null
          name: string
          rate_bps: number
          rule_key: string
          updated_at?: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          is_active?: boolean
          memo?: string | null
          name?: string
          rate_bps?: number
          rule_key?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_rules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          account_id: string | null
          amount: number
          card_id: string | null
          category_id: string
          created_at: string
          end_month: string | null
          expense_nature: Database["public"]["Enums"]["expense_nature"] | null
          fund_purpose: Database["public"]["Enums"]["fund_purpose"] | null
          household_id: string
          id: string
          is_active: boolean
          memo: string | null
          name: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          payment_day: number
          rate_rule_id: string | null
          show_occurrence_progress: boolean
          start_month: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          card_id?: string | null
          category_id: string
          created_at?: string
          end_month?: string | null
          expense_nature?: Database["public"]["Enums"]["expense_nature"] | null
          fund_purpose?: Database["public"]["Enums"]["fund_purpose"] | null
          household_id: string
          id?: string
          is_active?: boolean
          memo?: string | null
          name: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          payment_day: number
          rate_rule_id?: string | null
          show_occurrence_progress?: boolean
          start_month: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          card_id?: string | null
          category_id?: string
          created_at?: string
          end_month?: string | null
          expense_nature?: Database["public"]["Enums"]["expense_nature"] | null
          fund_purpose?: Database["public"]["Enums"]["fund_purpose"] | null
          household_id?: string
          id?: string
          is_active?: boolean
          memo?: string | null
          name?: string
          owner_type?: Database["public"]["Enums"]["owner_type"]
          payment_day?: number
          rate_rule_id?: string | null
          show_occurrence_progress?: boolean
          start_month?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_rate_rule_id_fkey"
            columns: ["rate_rule_id"]
            isOneToOne: false
            referencedRelation: "rate_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          applied_living_rate_bps: number | null
          applied_rate_rule_id: string | null
          card_id: string | null
          category_id: string | null
          created_at: string
          effective_date: string
          effective_month: string | null
          expense_nature: Database["public"]["Enums"]["expense_nature"] | null
          expense_summary_group_snapshot:
            | Database["public"]["Enums"]["expense_summary_group"]
            | null
          fund_purpose: Database["public"]["Enums"]["fund_purpose"] | null
          household_id: string
          id: string
          income_summary_group_snapshot:
            | Database["public"]["Enums"]["income_summary_group"]
            | null
          is_asset_income_snapshot: boolean | null
          living_allocated_amount: number | null
          memo: string | null
          name: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          recurring_rule_id: string | null
          settlement_completed_at: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          applied_living_rate_bps?: number | null
          applied_rate_rule_id?: string | null
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          effective_date: string
          effective_month?: string | null
          expense_nature?: Database["public"]["Enums"]["expense_nature"] | null
          expense_summary_group_snapshot?:
            | Database["public"]["Enums"]["expense_summary_group"]
            | null
          fund_purpose?: Database["public"]["Enums"]["fund_purpose"] | null
          household_id: string
          id?: string
          income_summary_group_snapshot?:
            | Database["public"]["Enums"]["income_summary_group"]
            | null
          is_asset_income_snapshot?: boolean | null
          living_allocated_amount?: number | null
          memo?: string | null
          name: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          recurring_rule_id?: string | null
          settlement_completed_at?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          applied_living_rate_bps?: number | null
          applied_rate_rule_id?: string | null
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          effective_date?: string
          effective_month?: string | null
          expense_nature?: Database["public"]["Enums"]["expense_nature"] | null
          expense_summary_group_snapshot?:
            | Database["public"]["Enums"]["expense_summary_group"]
            | null
          fund_purpose?: Database["public"]["Enums"]["fund_purpose"] | null
          household_id?: string
          id?: string
          income_summary_group_snapshot?:
            | Database["public"]["Enums"]["income_summary_group"]
            | null
          is_asset_income_snapshot?: boolean | null
          living_allocated_amount?: number | null
          memo?: string | null
          name?: string
          owner_type?: Database["public"]["Enums"]["owner_type"]
          recurring_rule_id?: string | null
          settlement_completed_at?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_applied_rate_rule_id_fkey"
            columns: ["applied_rate_rule_id"]
            isOneToOne: false
            referencedRelation: "rate_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_rule_id_fkey"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_household_with_admin: {
        Args: { p_display_name: string; p_household_name: string }
        Returns: string
      }
      create_rate_rule: {
        Args: {
          p_household_id: string
          p_memo: string
          p_name: string
          p_rate_bps: number
          p_valid_from: string
        }
        Returns: string
      }
      create_rate_rule_version: {
        Args: {
          p_memo: string
          p_name: string
          p_rate_bps: number
          p_rate_rule_id: string
          p_valid_from: string
        }
        Returns: string
      }
      delete_planned_manual_transaction: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      delete_unused_account: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      delete_unused_card: { Args: { p_card_id: string }; Returns: undefined }
      delete_unused_category: {
        Args: { p_category_id: string }
        Returns: undefined
      }
      delete_unused_recurring_rule: {
        Args: { p_recurring_rule_id: string }
        Returns: undefined
      }
      generate_recurring_transactions: {
        Args: { p_household_id: string; p_target_month: string }
        Returns: number
      }
      set_living_account: { Args: { p_account_id: string }; Returns: undefined }
      set_transaction_status: {
        Args: {
          p_status: Database["public"]["Enums"]["transaction_status"]
          p_transaction_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      expense_nature: "fixed" | "variable" | "irregular"
      expense_summary_group:
        | "monthly"
        | "annual"
        | "variable"
        | "repayment_saving"
      fund_purpose: "living" | "investment"
      income_summary_group: "earned" | "asset" | "variable"
      owner_type: "wife" | "husband" | "joint"
      transaction_status: "planned" | "confirmed" | "cancelled"
      transaction_type: "income" | "expense" | "transfer"
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
      expense_nature: ["fixed", "variable", "irregular"],
      expense_summary_group: [
        "monthly",
        "annual",
        "variable",
        "repayment_saving",
      ],
      fund_purpose: ["living", "investment"],
      income_summary_group: ["earned", "asset", "variable"],
      owner_type: ["wife", "husband", "joint"],
      transaction_status: ["planned", "confirmed", "cancelled"],
      transaction_type: ["income", "expense", "transfer"],
    },
  },
} as const
