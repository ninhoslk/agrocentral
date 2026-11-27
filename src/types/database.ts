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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      budget_lines: {
        Row: {
          id: string
          organization_id: string
          farm_id: string | null
          season_id: string | null
          field_id: string | null
          crop_id: string | null
          activity_id: string | null
          category_id: string
          subcategory: string | null
          contact_id: string | null
          inventory_item_id: string | null
          equipment_id: string | null
          kind: string
          expense_type: string
          description: string
          unit: string | null
          quantity: number
          unit_price: number
          total_amount: number
          planned_date: string
          actual_date: string | null
          payment_method: string | null
          payment_terms: string | null
          installments: number
          recurrence: string
          recurrence_group: string | null
          is_extraordinary: boolean
          status: string
          notes: string | null
          is_demo: boolean
          archived_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          farm_id?: string | null
          season_id?: string | null
          field_id?: string | null
          crop_id?: string | null
          activity_id?: string | null
          category_id: string
          subcategory?: string | null
          contact_id?: string | null
          inventory_item_id?: string | null
          equipment_id?: string | null
          kind?: string
          expense_type?: string
          description: string
          unit?: string | null
          quantity?: number
          unit_price: number
          planned_date: string
          actual_date?: string | null
          payment_method?: string | null
          payment_terms?: string | null
          installments?: number
          recurrence?: string
          recurrence_group?: string | null
          is_extraordinary?: boolean
          status?: string
          notes?: string | null
          is_demo?: boolean
          archived_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          farm_id?: string | null
          season_id?: string | null
          field_id?: string | null
          crop_id?: string | null
          activity_id?: string | null
          category_id?: string
          subcategory?: string | null
          contact_id?: string | null
          inventory_item_id?: string | null
          equipment_id?: string | null
          kind?: string
          expense_type?: string
          description?: string
          unit?: string | null
          quantity?: number
          unit_price?: number
          planned_date?: string
          actual_date?: string | null
          payment_method?: string | null
          payment_terms?: string | null
          installments?: number
          recurrence?: string
          recurrence_group?: string | null
          is_extraordinary?: boolean
          status?: string
          notes?: string | null
          is_demo?: boolean
          archived_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      budget_scenarios: {
        Row: {
          id: string
          organization_id: string
          farm_id: string | null
          season_id: string | null
          name: string
          kind: string
          price_pct: number
          yield_pct: number
          cost_pct: number
          category_pct: Json
          extra_investment: number
          notes: string | null
          is_demo: boolean
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          farm_id?: string | null
          season_id?: string | null
          name: string
          kind?: string
          price_pct?: number
          yield_pct?: number
          cost_pct?: number
          category_pct?: Json
          extra_investment?: number
          notes?: string | null
          is_demo?: boolean
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          farm_id?: string | null
          season_id?: string | null
          name?: string
          kind?: string
          price_pct?: number
          yield_pct?: number
          cost_pct?: number
          category_pct?: Json
          extra_investment?: number
          notes?: string | null
          is_demo?: boolean
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          activity_type_id: string
          archived_at: string | null
          area_worked_ha: number | null
          created_at: string
          created_by: string | null
          ended_at: string | null
          equipment_id: string | null
          farm_id: string
          field_id: string | null
          id: string
          inputs_cost: number
          is_demo: boolean
          labor_cost: number
          notes: string | null
          organization_id: string
          other_cost: number
          responsible_employee_id: string | null
          season_id: string | null
          started_at: string
          status: string
          team_id: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activity_type_id: string
          archived_at?: string | null
          area_worked_ha?: number | null
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          equipment_id?: string | null
          farm_id: string
          field_id?: string | null
          id?: string
          inputs_cost?: number
          is_demo?: boolean
          labor_cost?: number
          notes?: string | null
          organization_id: string
          other_cost?: number
          responsible_employee_id?: string | null
          season_id?: string | null
          started_at: string
          status?: string
          team_id?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activity_type_id?: string
          archived_at?: string | null
          area_worked_ha?: number | null
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          equipment_id?: string | null
          farm_id?: string
          field_id?: string | null
          id?: string
          inputs_cost?: number
          is_demo?: boolean
          labor_cost?: number
          notes?: string | null
          organization_id?: string
          other_cost?: number
          responsible_employee_id?: string | null
          season_id?: string | null
          started_at?: string
          status?: string
          team_id?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_equipment_id_fkey"
            columns: ["organization_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "activities_organization_id_farm_id_fkey"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "activities_organization_id_field_id_fkey"
            columns: ["organization_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_responsible_employee_id_fkey"
            columns: ["organization_id", "responsible_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "activities_organization_id_season_id_fkey"
            columns: ["organization_id", "season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "activities_organization_id_team_id_fkey"
            columns: ["organization_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      activity_inputs: {
        Row: {
          activity_id: string
          created_at: string
          created_by: string | null
          dose_per_ha: number | null
          farm_id: string | null
          id: string
          is_demo: boolean
          item_id: string
          notes: string | null
          organization_id: string
          quantity: number
          stock_movement_id: string | null
          total_cost: number | null
          unit_cost: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activity_id: string
          created_at?: string
          created_by?: string | null
          dose_per_ha?: number | null
          farm_id?: string | null
          id?: string
          is_demo?: boolean
          item_id: string
          notes?: string | null
          organization_id: string
          quantity: number
          stock_movement_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activity_id?: string
          created_at?: string
          created_by?: string | null
          dose_per_ha?: number | null
          farm_id?: string | null
          id?: string
          is_demo?: boolean
          item_id?: string
          notes?: string | null
          organization_id?: string
          quantity?: number
          stock_movement_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_inputs_organization_id_activity_id_fkey"
            columns: ["organization_id", "activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "activity_inputs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_inputs_organization_id_item_id_fkey"
            columns: ["organization_id", "item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "activity_inputs_stock_movement_id_fkey"
            columns: ["stock_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_types: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          organization_id: string | null
          slug: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          slug?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor: string | null
          at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          archived_at: string | null
          city: string | null
          created_at: string
          created_by: string | null
          document: string | null
          email: string | null
          id: string
          is_demo: boolean
          kind: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          state: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          buyer_id: string
          buyer_name: string | null
          created_at: string
          id: string
          last_message_at: string
          listing_id: string
          seller_id: string
          status: string
        }
        Insert: {
          buyer_id?: string
          buyer_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id: string
          seller_id: string
          status?: string
        }
        Update: {
          buyer_id?: string
          buyer_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id?: string
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          name: string
          notes: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          name: string
          notes?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crops: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string | null
          sack_weight_kg: number | null
          slug: string | null
          updated_at: string
          updated_by: string | null
          yield_unit: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id?: string | null
          sack_weight_kg?: number | null
          slug?: string | null
          updated_at?: string
          updated_by?: string | null
          yield_unit?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          sack_weight_kg?: number | null
          slug?: string | null
          updated_at?: string
          updated_by?: string | null
          yield_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "crops_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          activity_id: string | null
          archived_at: string | null
          created_at: string
          created_by: string | null
          doc_type: string
          equipment_id: string | null
          expires_at: string | null
          farm_id: string | null
          field_id: string | null
          id: string
          is_demo: boolean
          issue_date: string | null
          mime_type: string
          name: string
          notes: string | null
          organization_id: string
          responsible: string | null
          season_id: string | null
          size_bytes: number
          storage_path: string
          tags: string[]
          transaction_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activity_id?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          doc_type?: string
          equipment_id?: string | null
          expires_at?: string | null
          farm_id?: string | null
          field_id?: string | null
          id?: string
          is_demo?: boolean
          issue_date?: string | null
          mime_type: string
          name: string
          notes?: string | null
          organization_id: string
          responsible?: string | null
          season_id?: string | null
          size_bytes: number
          storage_path: string
          tags?: string[]
          transaction_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activity_id?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          doc_type?: string
          equipment_id?: string | null
          expires_at?: string | null
          farm_id?: string | null
          field_id?: string | null
          id?: string
          is_demo?: boolean
          issue_date?: string | null
          mime_type?: string
          name?: string
          notes?: string | null
          organization_id?: string
          responsible?: string | null
          season_id?: string | null
          size_bytes?: number
          storage_path?: string
          tags?: string[]
          transaction_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_activity_id_fkey"
            columns: ["organization_id", "activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "documents_organization_id_equipment_id_fkey"
            columns: ["organization_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "documents_organization_id_farm_id_fkey"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "documents_organization_id_field_id_fkey"
            columns: ["organization_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_season_id_fkey"
            columns: ["organization_id", "season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "documents_organization_id_transaction_id_fkey"
            columns: ["organization_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "documents_organization_id_transaction_id_fkey"
            columns: ["organization_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions_v"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      employees: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          email: string | null
          farm_id: string | null
          full_name: string
          hire_date: string | null
          hourly_cost: number | null
          id: string
          is_demo: boolean
          notes: string | null
          organization_id: string
          phone: string | null
          role_title: string | null
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          farm_id?: string | null
          full_name: string
          hire_date?: string | null
          hourly_cost?: number | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          organization_id: string
          phone?: string | null
          role_title?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          farm_id?: string | null
          full_name?: string
          hire_date?: string | null
          hourly_cost?: number | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          organization_id?: string
          phone?: string | null
          role_title?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_organization_id_farm_id_fkey"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          acquisition_date: string | null
          acquisition_value: number | null
          archived_at: string | null
          brand: string | null
          created_at: string
          created_by: string | null
          farm_id: string | null
          fuel_type: string | null
          hour_meter: number
          id: string
          identifier: string | null
          is_demo: boolean
          kind: string
          last_maintenance_date: string | null
          last_maintenance_hours: number | null
          maintenance_interval_days: number | null
          maintenance_interval_hours: number | null
          model: string | null
          name: string
          notes: string | null
          odometer_km: number
          organization_id: string
          plate: string | null
          serial_number: string | null
          status: string
          updated_at: string
          updated_by: string | null
          year: number | null
        }
        Insert: {
          acquisition_date?: string | null
          acquisition_value?: number | null
          archived_at?: string | null
          brand?: string | null
          created_at?: string
          created_by?: string | null
          farm_id?: string | null
          fuel_type?: string | null
          hour_meter?: number
          id?: string
          identifier?: string | null
          is_demo?: boolean
          kind: string
          last_maintenance_date?: string | null
          last_maintenance_hours?: number | null
          maintenance_interval_days?: number | null
          maintenance_interval_hours?: number | null
          model?: string | null
          name: string
          notes?: string | null
          odometer_km?: number
          organization_id: string
          plate?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          year?: number | null
        }
        Update: {
          acquisition_date?: string | null
          acquisition_value?: number | null
          archived_at?: string | null
          brand?: string | null
          created_at?: string
          created_by?: string | null
          farm_id?: string | null
          fuel_type?: string | null
          hour_meter?: number
          id?: string
          identifier?: string | null
          is_demo?: boolean
          kind?: string
          last_maintenance_date?: string | null
          last_maintenance_hours?: number | null
          maintenance_interval_days?: number | null
          maintenance_interval_hours?: number | null
          model?: string | null
          name?: string
          notes?: string | null
          odometer_km?: number
          organization_id?: string
          plate?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_organization_id_farm_id_fkey"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_usage: {
        Row: {
          activity_id: string | null
          created_at: string
          created_by: string | null
          equipment_id: string
          farm_id: string | null
          field_id: string | null
          fuel_cost: number | null
          fuel_liters: number | null
          hour_meter_end: number | null
          hours: number | null
          id: string
          is_demo: boolean
          km: number | null
          notes: string | null
          operator_employee_id: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
          usage_date: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          created_by?: string | null
          equipment_id: string
          farm_id?: string | null
          field_id?: string | null
          fuel_cost?: number | null
          fuel_liters?: number | null
          hour_meter_end?: number | null
          hours?: number | null
          id?: string
          is_demo?: boolean
          km?: number | null
          notes?: string | null
          operator_employee_id?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
          usage_date: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          created_by?: string | null
          equipment_id?: string
          farm_id?: string | null
          field_id?: string | null
          fuel_cost?: number | null
          fuel_liters?: number | null
          hour_meter_end?: number | null
          hours?: number | null
          id?: string
          is_demo?: boolean
          km?: number | null
          notes?: string | null
          operator_employee_id?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_usage_organization_id_activity_id_fkey"
            columns: ["organization_id", "activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "equipment_usage_organization_id_equipment_id_fkey"
            columns: ["organization_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "equipment_usage_organization_id_field_id_fkey"
            columns: ["organization_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "equipment_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_usage_organization_id_operator_employee_id_fkey"
            columns: ["organization_id", "operator_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      farms: {
        Row: {
          address: string | null
          archived_at: string | null
          boundary: unknown
          boundary_area_ha: number | null
          boundary_geojson: Json | null
          boundary_perimeter_m: number | null
          car_code: string | null
          city: string | null
          code: string | null
          created_at: string
          created_by: string | null
          id: string
          incra_code: string | null
          is_demo: boolean
          latitude: number | null
          legal_reserve_ha: number | null
          longitude: number | null
          name: string
          notes: string | null
          organization_id: string
          owner_name: string | null
          preservation_area_ha: number | null
          productive_area_ha: number | null
          state: string | null
          tenure_type: string | null
          total_area_ha: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          boundary?: unknown
          boundary_area_ha?: number | null
          boundary_geojson?: Json | null
          boundary_perimeter_m?: number | null
          car_code?: string | null
          city?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          incra_code?: string | null
          is_demo?: boolean
          latitude?: number | null
          legal_reserve_ha?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          organization_id: string
          owner_name?: string | null
          preservation_area_ha?: number | null
          productive_area_ha?: number | null
          state?: string | null
          tenure_type?: string | null
          total_area_ha?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          boundary?: unknown
          boundary_area_ha?: number | null
          boundary_geojson?: Json | null
          boundary_perimeter_m?: number | null
          car_code?: string | null
          city?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          incra_code?: string | null
          is_demo?: boolean
          latitude?: number | null
          legal_reserve_ha?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          owner_name?: string | null
          preservation_area_ha?: number | null
          productive_area_ha?: number | null
          state?: string | null
          tenure_type?: string | null
          total_area_ha?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          archived_at: string | null
          area_ha: number | null
          code: string | null
          color: string | null
          created_at: string
          created_by: string | null
          farm_id: string
          geojson: Json | null
          geom: unknown
          id: string
          irrigation: string
          is_demo: boolean
          manual_area_ha: number | null
          name: string
          notes: string | null
          organization_id: string
          perimeter_m: number | null
          relief: string | null
          soil_type: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          area_ha?: number | null
          code?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          farm_id: string
          geojson?: Json | null
          geom?: unknown
          id?: string
          irrigation?: string
          is_demo?: boolean
          manual_area_ha?: number | null
          name: string
          notes?: string | null
          organization_id: string
          perimeter_m?: number | null
          relief?: string | null
          soil_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          area_ha?: number | null
          code?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          farm_id?: string
          geojson?: Json | null
          geom?: unknown
          id?: string
          irrigation?: string
          is_demo?: boolean
          manual_area_ha?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          perimeter_m?: number | null
          relief?: string | null
          soil_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fields_organization_id_farm_id_fkey"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          archived_at: string | null
          bank: string | null
          created_at: string
          created_by: string | null
          id: string
          initial_balance: number
          is_demo: boolean
          kind: string
          name: string
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          bank?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          initial_balance?: number
          is_demo?: boolean
          kind?: string
          name: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          bank?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          initial_balance?: number
          is_demo?: boolean
          kind?: string
          name?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          organization_id: string | null
          slug: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          name: string
          organization_id?: string | null
          slug?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          organization_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      geocode_cache: {
        Row: {
          fetched_at: string
          provider: string
          query_norm: string
          results: Json
        }
        Insert: {
          fetched_at?: string
          provider: string
          query_norm: string
          results: Json
        }
        Update: {
          fetched_at?: string
          provider?: string
          query_norm?: string
          results?: Json
        }
        Relationships: []
      }
      geometry_history: {
        Row: {
          area_ha: number | null
          changed_at: string
          changed_by: string | null
          entity_id: string
          entity_type: string
          farm_id: string
          geojson: Json | null
          id: number
          organization_id: string
        }
        Insert: {
          area_ha?: number | null
          changed_at?: string
          changed_by?: string | null
          entity_id: string
          entity_type: string
          farm_id: string
          geojson?: Json | null
          id?: never
          organization_id: string
        }
        Update: {
          area_ha?: number | null
          changed_at?: string
          changed_by?: string | null
          entity_id?: string
          entity_type?: string
          farm_id?: string
          geojson?: Json | null
          id?: never
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geometry_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      harvest_records: {
        Row: {
          created_at: string
          created_by: string | null
          destination: string | null
          farm_id: string
          field_id: string
          harvest_date: string
          id: string
          impurity_pct: number | null
          is_demo: boolean
          losses_kg: number | null
          moisture_pct: number | null
          notes: string | null
          organization_id: string
          quality: string | null
          quantity: number
          quantity_kg: number | null
          season_id: string
          unit: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination?: string | null
          farm_id: string
          field_id: string
          harvest_date: string
          id?: string
          impurity_pct?: number | null
          is_demo?: boolean
          losses_kg?: number | null
          moisture_pct?: number | null
          notes?: string | null
          organization_id: string
          quality?: string | null
          quantity: number
          quantity_kg?: number | null
          season_id: string
          unit: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination?: string | null
          farm_id?: string
          field_id?: string
          harvest_date?: string
          id?: string
          impurity_pct?: number | null
          is_demo?: boolean
          losses_kg?: number | null
          moisture_pct?: number | null
          notes?: string | null
          organization_id?: string
          quality?: string | null
          quantity?: number
          quantity_kg?: number | null
          season_id?: string
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "harvest_records_organization_id_field_id_fkey"
            columns: ["organization_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "harvest_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvest_records_organization_id_season_id_fkey"
            columns: ["organization_id", "season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          at: string
          duration_ms: number | null
          endpoint: string | null
          error: string | null
          http_status: number | null
          id: number
          provider: string
          status: string
        }
        Insert: {
          at?: string
          duration_ms?: number | null
          endpoint?: string | null
          error?: string | null
          http_status?: number | null
          id?: never
          provider: string
          status: string
        }
        Update: {
          at?: string
          duration_ms?: number | null
          endpoint?: string | null
          error?: string | null
          http_status?: number | null
          id?: never
          provider?: string
          status?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          active_ingredient: string | null
          archived_at: string | null
          average_cost: number
          category: string
          created_at: string
          created_by: string | null
          current_quantity: number
          farm_id: string | null
          id: string
          is_demo: boolean
          location_id: string | null
          min_quantity: number | null
          name: string
          notes: string | null
          organization_id: string
          registration_number: string | null
          supplier_id: string | null
          unit: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_ingredient?: string | null
          archived_at?: string | null
          average_cost?: number
          category: string
          created_at?: string
          created_by?: string | null
          current_quantity?: number
          farm_id?: string | null
          id?: string
          is_demo?: boolean
          location_id?: string | null
          min_quantity?: number | null
          name: string
          notes?: string | null
          organization_id: string
          registration_number?: string | null
          supplier_id?: string | null
          unit: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_ingredient?: string | null
          archived_at?: string | null
          average_cost?: number
          category?: string
          created_at?: string
          created_by?: string | null
          current_quantity?: number
          farm_id?: string | null
          id?: string
          is_demo?: boolean
          location_id?: string | null
          min_quantity?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          registration_number?: string | null
          supplier_id?: string | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_organization_id_farm_id_fkey"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "inventory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_organization_id_location_id_fkey"
            columns: ["organization_id", "location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "inventory_items_organization_id_supplier_id_fkey"
            columns: ["organization_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          created_at: string
          created_by: string | null
          farm_id: string | null
          id: string
          is_demo: boolean
          name: string
          notes: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          farm_id?: string | null
          id?: string
          is_demo?: boolean
          name: string
          notes?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          farm_id?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_locations_organization_id_farm_id_fkey"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "inventory_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          all_farms: boolean
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          farm_ids: string[]
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          all_farms?: boolean
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          farm_ids?: string[]
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          all_farms?: boolean
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          farm_ids?: string[]
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_favorites: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_media: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          position: number
          seller_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          position?: number
          seller_id?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          position?: number
          seller_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_media_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          listing_id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          listing_id: string
          reason: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          listing_id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          attributes: Json
          brand: string | null
          category_id: string
          city: string
          condition: string
          contact_phone: string | null
          created_at: string
          currency: string
          description: string
          expires_at: string | null
          hours_used: number | null
          id: string
          is_demo: boolean
          model: string | null
          moderation_note: string | null
          moderation_status: string
          negotiable: boolean
          organization_id: string | null
          price: number | null
          price_unit: string | null
          published_at: string | null
          quantity: number | null
          search_vector: unknown
          seller_id: string
          seller_name: string
          show_phone: boolean
          state: string
          status: string
          title: string
          unit: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          attributes?: Json
          brand?: string | null
          category_id: string
          city: string
          condition?: string
          contact_phone?: string | null
          created_at?: string
          currency?: string
          description: string
          expires_at?: string | null
          hours_used?: number | null
          id?: string
          is_demo?: boolean
          model?: string | null
          moderation_note?: string | null
          moderation_status?: string
          negotiable?: boolean
          organization_id?: string | null
          price?: number | null
          price_unit?: string | null
          published_at?: string | null
          quantity?: number | null
          search_vector?: unknown
          seller_id?: string
          seller_name: string
          show_phone?: boolean
          state: string
          status?: string
          title: string
          unit?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          attributes?: Json
          brand?: string | null
          category_id?: string
          city?: string
          condition?: string
          contact_phone?: string | null
          created_at?: string
          currency?: string
          description?: string
          expires_at?: string | null
          hours_used?: number | null
          id?: string
          is_demo?: boolean
          model?: string | null
          moderation_note?: string | null
          moderation_status?: string
          negotiable?: boolean
          organization_id?: string | null
          price?: number | null
          price_unit?: string | null
          published_at?: string | null
          quantity?: number | null
          search_vector?: unknown
          seller_id?: string
          seller_name?: string
          show_phone?: boolean
          state?: string
          status?: string
          title?: string
          unit?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          equipment_id: string
          farm_id: string | null
          hour_meter: number | null
          id: string
          is_demo: boolean
          kind: string
          labor_cost: number
          notes: string | null
          organization_id: string
          parts_cost: number
          performed_date: string | null
          provider: string | null
          scheduled_date: string | null
          status: string
          total_cost: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          equipment_id: string
          farm_id?: string | null
          hour_meter?: number | null
          id?: string
          is_demo?: boolean
          kind: string
          labor_cost?: number
          notes?: string | null
          organization_id: string
          parts_cost?: number
          performed_date?: string | null
          provider?: string | null
          scheduled_date?: string | null
          status?: string
          total_cost?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          equipment_id?: string
          farm_id?: string | null
          hour_meter?: number | null
          id?: string
          is_demo?: boolean
          kind?: string
          labor_cost?: number
          notes?: string | null
          organization_id?: string
          parts_cost?: number
          performed_date?: string | null
          provider?: string | null
          scheduled_date?: string | null
          status?: string
          total_cost?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_organization_id_equipment_id_fkey"
            columns: ["organization_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "maintenance_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      market_instruments: {
        Row: {
          currency: string
          description: string | null
          id: string
          kind: string
          name: string
          provider: string | null
          provider_series: string | null
          sort: number
          unit: string
        }
        Insert: {
          currency?: string
          description?: string | null
          id: string
          kind: string
          name: string
          provider?: string | null
          provider_series?: string | null
          sort?: number
          unit: string
        }
        Update: {
          currency?: string
          description?: string | null
          id?: string
          kind?: string
          name?: string
          provider?: string | null
          provider_series?: string | null
          sort?: number
          unit?: string
        }
        Relationships: []
      }
      market_quotes: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          fetched_at: string
          id: string
          instrument_id: string
          is_demo: boolean
          notes: string | null
          observed_at: string
          organization_id: string | null
          payload: Json | null
          region: string
          source: string
          source_url: string | null
          status: string
          unit: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          fetched_at?: string
          id?: string
          instrument_id: string
          is_demo?: boolean
          notes?: string | null
          observed_at: string
          organization_id?: string | null
          payload?: Json | null
          region?: string
          source: string
          source_url?: string | null
          status: string
          unit: string
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          fetched_at?: string
          id?: string
          instrument_id?: string
          is_demo?: boolean
          notes?: string | null
          observed_at?: string
          organization_id?: string | null
          payload?: Json | null
          region?: string
          source?: string
          source_url?: string | null
          status?: string
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_quotes_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "market_instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_categories: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          restricted_note: string | null
          sort: number
        }
        Insert: {
          id: string
          name: string
          parent_id?: string | null
          restricted_note?: string | null
          sort?: number
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          restricted_note?: string | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_farms: {
        Row: {
          created_at: string
          farm_id: string
          membership_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          membership_id: string
          organization_id: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          membership_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_farms_farm_fk"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "membership_farms_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_farms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          all_farms: boolean
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_farms?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_farms?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          kind: string
          offer_amount: number | null
          offer_status: string | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          kind?: string
          offer_amount?: number | null
          offer_status?: string | null
          read_at?: string | null
          sender_id?: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          kind?: string
          offer_amount?: number | null
          offer_status?: string | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: string
          email: boolean
          in_app: boolean
          min_priority: string
          quiet_end: string | null
          quiet_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          email?: boolean
          in_app?: boolean
          min_priority?: string
          quiet_end?: string | null
          quiet_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          category?: string
          email?: boolean
          in_app?: boolean
          min_priority?: string
          quiet_end?: string | null
          quiet_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          archived_at: string | null
          body: string | null
          category: string
          created_at: string
          dedup_key: string
          id: string
          link: string | null
          organization_id: string | null
          priority: string
          read_at: string | null
          source: string | null
          title: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          archived_at?: string | null
          body?: string | null
          category: string
          created_at?: string
          dedup_key: string
          id?: string
          link?: string | null
          organization_id?: string | null
          priority?: string
          read_at?: string | null
          source?: string | null
          title: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          archived_at?: string | null
          body?: string | null
          category?: string
          created_at?: string
          dedup_key?: string
          id?: string
          link?: string | null
          organization_id?: string | null
          priority?: string
          read_at?: string | null
          source?: string | null
          title?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          enabled_modules: string[]
          id: string
          legal_document: string | null
          main_crop: string | null
          name: string
          plan: string
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          enabled_modules?: string[]
          id?: string
          legal_document?: string | null
          main_crop?: string | null
          name: string
          plan?: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          enabled_modules?: string[]
          id?: string
          legal_document?: string | null
          main_crop?: string | null
          name?: string
          plan?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      points_of_interest: {
        Row: {
          created_at: string
          created_by: string | null
          farm_id: string
          id: string
          is_demo: boolean
          kind: string
          latitude: number
          longitude: number
          name: string
          notes: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          farm_id: string
          id?: string
          is_demo?: boolean
          kind: string
          latitude: number
          longitude: number
          name: string
          notes?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          farm_id?: string
          id?: string
          is_demo?: boolean
          kind?: string
          latitude?: number
          longitude?: number
          name?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "points_of_interest_organization_id_farm_id_fkey"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "points_of_interest_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alert_events: {
        Row: {
          created_at: string
          direction: string
          id: string
          quote_id: string | null
          rule_id: string
          target_value: number
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          quote_id?: string | null
          rule_id: string
          target_value: number
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          quote_id?: string | null
          rule_id?: string
          target_value?: number
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_alert_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "market_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alert_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "price_alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alert_rules: {
        Row: {
          created_at: string
          created_by: string | null
          direction: string
          enabled: boolean
          id: string
          instrument_id: string
          is_demo: boolean
          last_triggered_at: string | null
          last_value: number | null
          notes: string | null
          organization_id: string
          region: string | null
          target_value: number
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          direction: string
          enabled?: boolean
          id?: string
          instrument_id: string
          is_demo?: boolean
          last_triggered_at?: string | null
          last_value?: number | null
          notes?: string | null
          organization_id: string
          region?: string | null
          target_value: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          direction?: string
          enabled?: boolean
          id?: string
          instrument_id?: string
          is_demo?: boolean
          last_triggered_at?: string | null
          last_value?: number | null
          notes?: string | null
          organization_id?: string
          region?: string | null
          target_value?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alert_rules_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "market_instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alert_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          last_organization_id: string | null
          onboarded_at: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          last_organization_id?: string | null
          onboarded_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_organization_id?: string | null
          onboarded_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_last_organization_id_fkey"
            columns: ["last_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          actions: string[]
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          actions: string[]
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          actions?: string[]
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      season_fields: {
        Row: {
          created_at: string
          created_by: string | null
          expected_harvest_date: string | null
          expected_yield_per_ha: number | null
          farm_id: string
          field_id: string
          id: string
          is_demo: boolean
          notes: string | null
          organization_id: string
          planted_area_ha: number | null
          planting_date: string | null
          population_per_ha: number | null
          season_id: string
          seed_rate_kg_ha: number | null
          seed_supplier: string | null
          stage: string | null
          updated_at: string
          updated_by: string | null
          variety_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_harvest_date?: string | null
          expected_yield_per_ha?: number | null
          farm_id: string
          field_id: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          organization_id: string
          planted_area_ha?: number | null
          planting_date?: string | null
          population_per_ha?: number | null
          season_id: string
          seed_rate_kg_ha?: number | null
          seed_supplier?: string | null
          stage?: string | null
          updated_at?: string
          updated_by?: string | null
          variety_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_harvest_date?: string | null
          expected_yield_per_ha?: number | null
          farm_id?: string
          field_id?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          organization_id?: string
          planted_area_ha?: number | null
          planting_date?: string | null
          population_per_ha?: number | null
          season_id?: string
          seed_rate_kg_ha?: number | null
          seed_supplier?: string | null
          stage?: string | null
          updated_at?: string
          updated_by?: string | null
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "season_fields_organization_id_field_id_fkey"
            columns: ["organization_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "season_fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_fields_organization_id_season_id_fkey"
            columns: ["organization_id", "season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "season_fields_organization_id_variety_id_fkey"
            columns: ["organization_id", "variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      seasons: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          crop_id: string
          cycle: string | null
          end_date: string | null
          estimated_cost: number | null
          expected_yield_per_ha: number | null
          farm_id: string
          id: string
          is_demo: boolean
          name: string
          notes: string | null
          organization_id: string
          responsible_employee_id: string | null
          start_date: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          crop_id: string
          cycle?: string | null
          end_date?: string | null
          estimated_cost?: number | null
          expected_yield_per_ha?: number | null
          farm_id: string
          id?: string
          is_demo?: boolean
          name: string
          notes?: string | null
          organization_id: string
          responsible_employee_id?: string | null
          start_date: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          crop_id?: string
          cycle?: string | null
          end_date?: string | null
          estimated_cost?: number | null
          expected_yield_per_ha?: number | null
          farm_id?: string
          id?: string
          is_demo?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          responsible_employee_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasons_organization_id_farm_id_fkey"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "seasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasons_responsible_fk"
            columns: ["organization_id", "responsible_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      stock_lots: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          farm_id: string | null
          id: string
          is_demo: boolean
          item_id: string
          lot_code: string
          organization_id: string
          quantity: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          farm_id?: string | null
          id?: string
          is_demo?: boolean
          item_id: string
          lot_code: string
          organization_id: string
          quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          farm_id?: string | null
          id?: string
          is_demo?: boolean
          item_id?: string
          lot_code?: string
          organization_id?: string
          quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_lots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_lots_organization_id_item_id_fkey"
            columns: ["organization_id", "item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          activity_id: string | null
          balance_after: number | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          document_number: string | null
          farm_id: string | null
          field_id: string | null
          id: string
          is_demo: boolean
          item_id: string
          kind: string
          location_from_id: string | null
          location_to_id: string | null
          lot_code: string | null
          lot_expires_at: string | null
          lot_id: string | null
          notes: string | null
          occurred_at: string
          organization_id: string
          quantity: number
          season_id: string | null
          total_cost: number | null
          unit_cost: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activity_id?: string | null
          balance_after?: number | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          document_number?: string | null
          farm_id?: string | null
          field_id?: string | null
          id?: string
          is_demo?: boolean
          item_id: string
          kind: string
          location_from_id?: string | null
          location_to_id?: string | null
          lot_code?: string | null
          lot_expires_at?: string | null
          lot_id?: string | null
          notes?: string | null
          occurred_at?: string
          organization_id: string
          quantity: number
          season_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activity_id?: string | null
          balance_after?: number | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          document_number?: string | null
          farm_id?: string | null
          field_id?: string | null
          id?: string
          is_demo?: boolean
          item_id?: string
          kind?: string
          location_from_id?: string | null
          location_to_id?: string | null
          lot_code?: string | null
          lot_expires_at?: string | null
          lot_id?: string | null
          notes?: string | null
          occurred_at?: string
          organization_id?: string
          quantity?: number
          season_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_organization_id_activity_id_fkey"
            columns: ["organization_id", "activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_contact_id_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_field_id_fkey"
            columns: ["organization_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_item_id_fkey"
            columns: ["organization_id", "item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_location_from_id_fkey"
            columns: ["organization_id", "location_from_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_location_to_id_fkey"
            columns: ["organization_id", "location_to_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_lot_id_fkey"
            columns: ["organization_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "stock_lots"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_season_id_fkey"
            columns: ["organization_id", "season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      tasks: {
        Row: {
          activity_id: string | null
          archived_at: string | null
          assignee_employee_id: string | null
          assignee_user_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          farm_id: string | null
          field_id: string | null
          id: string
          is_demo: boolean
          organization_id: string
          priority: string
          season_id: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activity_id?: string | null
          archived_at?: string | null
          assignee_employee_id?: string | null
          assignee_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          farm_id?: string | null
          field_id?: string | null
          id?: string
          is_demo?: boolean
          organization_id: string
          priority?: string
          season_id?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activity_id?: string | null
          archived_at?: string | null
          assignee_employee_id?: string | null
          assignee_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          farm_id?: string | null
          field_id?: string | null
          id?: string
          is_demo?: boolean
          organization_id?: string
          priority?: string
          season_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_activity_id_fkey"
            columns: ["organization_id", "activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "tasks_organization_id_assignee_employee_id_fkey"
            columns: ["organization_id", "assignee_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "tasks_organization_id_farm_id_fkey"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "tasks_organization_id_field_id_fkey"
            columns: ["organization_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_season_id_fkey"
            columns: ["organization_id", "season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          employee_id: string
          organization_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          organization_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          organization_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_organization_id_employee_id_fkey"
            columns: ["organization_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_organization_id_team_id_fkey"
            columns: ["organization_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string | null
          farm_id: string | null
          id: string
          is_demo: boolean
          leader_employee_id: string | null
          name: string
          notes: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          farm_id?: string | null
          id?: string
          is_demo?: boolean
          leader_employee_id?: string | null
          name: string
          notes?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          farm_id?: string | null
          id?: string
          is_demo?: boolean
          leader_employee_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_farm_id_fkey"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_organization_id_leader_employee_id_fkey"
            columns: ["organization_id", "leader_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      transactions: {
        Row: {
          budget_line_id: string | null
          account_id: string | null
          activity_id: string | null
          amount: number
          archived_at: string | null
          category_id: string
          contact_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          crop_id: string | null
          description: string
          document_number: string | null
          due_date: string
          farm_id: string | null
          field_id: string | null
          id: string
          installment_count: number | null
          installment_group: string | null
          installment_number: number | null
          is_demo: boolean
          issue_date: string
          kind: string
          notes: string | null
          organization_id: string
          paid_date: string | null
          payment_method: string | null
          quantity: number | null
          quantity_unit: string | null
          season_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          budget_line_id?: string | null
          account_id?: string | null
          activity_id?: string | null
          amount: number
          archived_at?: string | null
          category_id: string
          contact_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          crop_id?: string | null
          description: string
          document_number?: string | null
          due_date: string
          farm_id?: string | null
          field_id?: string | null
          id?: string
          installment_count?: number | null
          installment_group?: string | null
          installment_number?: number | null
          is_demo?: boolean
          issue_date?: string
          kind: string
          notes?: string | null
          organization_id: string
          paid_date?: string | null
          payment_method?: string | null
          quantity?: number | null
          quantity_unit?: string | null
          season_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          budget_line_id?: string | null
          account_id?: string | null
          activity_id?: string | null
          amount?: number
          archived_at?: string | null
          category_id?: string
          contact_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          crop_id?: string | null
          description?: string
          document_number?: string | null
          due_date?: string
          farm_id?: string | null
          field_id?: string | null
          id?: string
          installment_count?: number | null
          installment_group?: string | null
          installment_number?: number | null
          is_demo?: boolean
          issue_date?: string
          kind?: string
          notes?: string | null
          organization_id?: string
          paid_date?: string | null
          payment_method?: string | null
          quantity?: number | null
          quantity_unit?: string | null
          season_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_account_id_fkey"
            columns: ["organization_id", "account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "transactions_organization_id_activity_id_fkey"
            columns: ["organization_id", "activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "transactions_organization_id_contact_id_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "transactions_organization_id_cost_center_id_fkey"
            columns: ["organization_id", "cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "transactions_organization_id_farm_id_fkey"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "transactions_organization_id_field_id_fkey"
            columns: ["organization_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_season_id_fkey"
            columns: ["organization_id", "season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          dashboard_layout: Json | null
          favorite_instruments: string[]
          market_region: string | null
          selected_farm_id: string | null
          units: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dashboard_layout?: Json | null
          favorite_instruments?: string[]
          market_region?: string | null
          selected_farm_id?: string | null
          units?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          dashboard_layout?: Json | null
          favorite_instruments?: string[]
          market_region?: string | null
          selected_farm_id?: string | null
          units?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      varieties: {
        Row: {
          created_at: string
          created_by: string | null
          crop_id: string
          cycle_days: number | null
          id: string
          is_demo: boolean
          name: string
          notes: string | null
          organization_id: string
          supplier: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          crop_id: string
          cycle_days?: number | null
          id?: string
          is_demo?: boolean
          name: string
          notes?: string | null
          organization_id: string
          supplier?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          crop_id?: string
          cycle_days?: number | null
          id?: string
          is_demo?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          supplier?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "varieties_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "varieties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_alert_events: {
        Row: {
          created_at: string
          data_status: string
          dedup_key: string
          farm_id: string
          fetched_at: string
          forecast_for: string | null
          id: string
          kind: string
          message: string
          observed_value: number | null
          organization_id: string
          provider: string
          rule_id: string | null
          threshold: number | null
        }
        Insert: {
          created_at?: string
          data_status?: string
          dedup_key: string
          farm_id: string
          fetched_at: string
          forecast_for?: string | null
          id?: string
          kind: string
          message: string
          observed_value?: number | null
          organization_id: string
          provider: string
          rule_id?: string | null
          threshold?: number | null
        }
        Update: {
          created_at?: string
          data_status?: string
          dedup_key?: string
          farm_id?: string
          fetched_at?: string
          forecast_for?: string | null
          id?: string
          kind?: string
          message?: string
          observed_value?: number | null
          organization_id?: string
          provider?: string
          rule_id?: string | null
          threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_alert_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weather_alert_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "weather_alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_alert_rules: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          farm_id: string
          id: string
          is_demo: boolean
          kind: string
          lookahead_days: number
          notes: string | null
          organization_id: string
          priority: string
          threshold: number
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          farm_id: string
          id?: string
          is_demo?: boolean
          kind: string
          lookahead_days?: number
          notes?: string | null
          organization_id: string
          priority?: string
          threshold: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          farm_id?: string
          id?: string
          is_demo?: boolean
          kind?: string
          lookahead_days?: number
          notes?: string | null
          organization_id?: string
          priority?: string
          threshold?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weather_alert_rules_organization_id_farm_id_fkey"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "weather_alert_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_cache: {
        Row: {
          fetched_at: string
          id: string
          last_error: string | null
          last_error_at: string | null
          lat: number
          lon: number
          payload: Json
          provider: string
          source_url: string | null
          status: string
          valid_until: string
        }
        Insert: {
          fetched_at: string
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          lat: number
          lon: number
          payload: Json
          provider: string
          source_url?: string | null
          status?: string
          valid_until: string
        }
        Update: {
          fetched_at?: string
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          lat?: number
          lon?: number
          payload?: Json
          provider?: string
          source_url?: string | null
          status?: string
          valid_until?: string
        }
        Relationships: []
      }
      work_logs: {
        Row: {
          activity_id: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          farm_id: string | null
          hours: number
          id: string
          is_demo: boolean
          notes: string | null
          organization_id: string
          task_id: string | null
          updated_at: string
          updated_by: string | null
          work_date: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          farm_id?: string | null
          hours: number
          id?: string
          is_demo?: boolean
          notes?: string | null
          organization_id: string
          task_id?: string | null
          updated_at?: string
          updated_by?: string | null
          work_date: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          farm_id?: string | null
          hours?: number
          id?: string
          is_demo?: boolean
          notes?: string | null
          organization_id?: string
          task_id?: string | null
          updated_at?: string
          updated_by?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_logs_organization_id_activity_id_fkey"
            columns: ["organization_id", "activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "work_logs_organization_id_employee_id_fkey"
            columns: ["organization_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "work_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_organization_id_task_id_fkey"
            columns: ["organization_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
    }
    Views: {
      budget_lines_v: {
        Row: {
          id: string
          organization_id: string
          farm_id: string | null
          season_id: string | null
          field_id: string | null
          crop_id: string | null
          activity_id: string | null
          category_id: string
          subcategory: string | null
          contact_id: string | null
          inventory_item_id: string | null
          equipment_id: string | null
          kind: string
          expense_type: string
          description: string
          unit: string | null
          quantity: number
          unit_price: number
          total_amount: number
          planned_date: string
          actual_date: string | null
          payment_method: string | null
          payment_terms: string | null
          installments: number
          recurrence: string
          recurrence_group: string | null
          is_extraordinary: boolean
          status: string
          notes: string | null
          is_demo: boolean
          archived_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
          category_name: string
          category_slug: string | null
          realized_amount: number
          paid_amount: number
          tx_count: number
        }
        Relationships: []
      }
      integration_status: {
        Row: {
          at: string | null
          duration_ms: number | null
          error: string | null
          http_status: number | null
          provider: string | null
          status: string | null
        }
        Relationships: []
      }
      transactions_v: {
        Row: {
          budget_line_id: string | null
          account_id: string | null
          activity_id: string | null
          amount: number | null
          archived_at: string | null
          category_id: string | null
          category_name: string | null
          contact_id: string | null
          cost_center_id: string | null
          created_at: string | null
          created_by: string | null
          crop_id: string | null
          description: string | null
          document_number: string | null
          due_date: string | null
          farm_id: string | null
          field_id: string | null
          id: string | null
          installment_count: number | null
          installment_group: string | null
          installment_number: number | null
          is_demo: boolean | null
          issue_date: string | null
          kind: string | null
          notes: string | null
          organization_id: string | null
          paid_date: string | null
          payment_method: string | null
          quantity: number | null
          quantity_unit: string | null
          season_id: string | null
          situation: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_account_id_fkey"
            columns: ["organization_id", "account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "transactions_organization_id_activity_id_fkey"
            columns: ["organization_id", "activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "transactions_organization_id_contact_id_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "transactions_organization_id_cost_center_id_fkey"
            columns: ["organization_id", "cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "transactions_organization_id_farm_id_fkey"
            columns: ["organization_id", "farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "transactions_organization_id_field_id_fkey"
            columns: ["organization_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_season_id_fkey"
            columns: ["organization_id", "season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      clear_demo_data: { Args: { p_org: string }; Returns: undefined }
      create_invitation: {
        Args: {
          p_all_farms: boolean
          p_email: string
          p_farm_ids: string[]
          p_org: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      create_organization: {
        Args: {
          p_city: string
          p_farm?: Json
          p_main_crop?: string
          p_name: string
          p_state: string
        }
        Returns: string
      }
      create_budget_lines: { Args: { p_rows: Json }; Returns: number }
      create_transactions: { Args: { p_rows: Json }; Returns: number }
      dashboard_summary: {
        Args: { p_farm?: string; p_org: string }
        Returns: Json
      }
      evaluate_weather_rules: {
        Args: { p_cache: string; p_farm: string }
        Returns: number
      }
      farms_with_weather_rules: {
        Args: never
        Returns: {
          farm_id: string
          latitude: number
          longitude: number
        }[]
      }
      get_invitation: {
        Args: { p_token: string }
        Returns: {
          email: string
          expires_at: string
          organization_name: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }[]
      }
      list_members: {
        Args: { p_org: string }
        Returns: {
          all_farms: boolean
          created_at: string
          email: string
          farm_ids: string[]
          full_name: string
          membership_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          user_id: string
        }[]
      }
      marketplace_counters: {
        Args: never
        Returns: {
          favorites: number
          my_active_listings: number
          unread_messages: number
        }[]
      }
      moderate_listing: {
        Args: { p_decision: string; p_listing: string; p_note?: string }
        Returns: undefined
      }
      my_permissions: {
        Args: { p_org: string }
        Returns: {
          actions: string[]
          all_farms: boolean
          farm_ids: string[]
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      register_activity: {
        Args: { p_activity: Json; p_inputs?: Json; p_usage?: Json }
        Returns: string
      }
      respond_offer: {
        Args: { p_action: string; p_message: string }
        Returns: undefined
      }
      seed_demo_data: { Args: { p_org: string }; Returns: string }
      set_member_access: {
        Args: {
          p_all_farms: boolean
          p_farm_ids: string[]
          p_membership: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_status?: string
        }
        Returns: undefined
      }
      take_rate_slot: {
        Args: { p_interval_ms: number; p_key: string }
        Returns: boolean
      }
      upsert_official_quotes: { Args: { p_rows: Json }; Returns: number }
      verify_cron_secret: { Args: { p_secret: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "manager"
        | "agronomist"
        | "finance"
        | "operator"
        | "viewer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "owner",
        "admin",
        "manager",
        "agronomist",
        "finance",
        "operator",
        "viewer",
      ],
    },
  },
} as const
