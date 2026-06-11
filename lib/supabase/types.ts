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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          checked_in_at: string
          class_date: string
          class_type: string | null
          id: string
          student_id: string
        }
        Insert: {
          checked_in_at?: string
          class_date: string
          class_type?: string | null
          id?: string
          student_id: string
        }
        Update: {
          checked_in_at?: string
          class_date?: string
          class_type?: string | null
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          channel_email: boolean
          channel_sms: boolean
          created_at: string
          delay_minutes: number
          email_body: string | null
          email_subject: string | null
          enabled: boolean
          gym_id: string
          id: string
          rule_key: Database["public"]["Enums"]["automation_rule_key"]
          sms_body: string | null
          updated_at: string
        }
        Insert: {
          channel_email?: boolean
          channel_sms?: boolean
          created_at?: string
          delay_minutes?: number
          email_body?: string | null
          email_subject?: string | null
          enabled?: boolean
          gym_id: string
          id?: string
          rule_key: Database["public"]["Enums"]["automation_rule_key"]
          sms_body?: string | null
          updated_at?: string
        }
        Update: {
          channel_email?: boolean
          channel_sms?: boolean
          created_at?: string
          delay_minutes?: number
          email_body?: string | null
          email_subject?: string | null
          enabled?: boolean
          gym_id?: string
          id?: string
          rule_key?: Database["public"]["Enums"]["automation_rule_key"]
          sms_body?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_triggers: {
        Row: {
          gym_id: string
          id: string
          sent: boolean
          student_id: string
          trigger_type: string
          triggered_at: string
        }
        Insert: {
          gym_id: string
          id?: string
          sent?: boolean
          student_id: string
          trigger_type: string
          triggered_at?: string
        }
        Update: {
          gym_id?: string
          id?: string
          sent?: boolean
          student_id?: string
          trigger_type?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_triggers_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_triggers_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      belt_progress: {
        Row: {
          current_belt: Database["public"]["Enums"]["belt_rank"]
          id: string
          progress_percentage: number
          skills_completed: Json
          stripes: number
          student_id: string
          updated_at: string
        }
        Insert: {
          current_belt?: Database["public"]["Enums"]["belt_rank"]
          id?: string
          progress_percentage?: number
          skills_completed?: Json
          stripes?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          current_belt?: Database["public"]["Enums"]["belt_rank"]
          id?: string
          progress_percentage?: number
          skills_completed?: Json
          stripes?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "belt_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          completed_at: string | null
          id: string
          joined_at: string
          student_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          id?: string
          joined_at?: string
          student_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          id?: string
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          end_date: string
          gym_id: string
          id: string
          key: string
          start_date: string
          target_classes: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          end_date: string
          gym_id: string
          id?: string
          key: string
          start_date: string
          target_classes?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          end_date?: string
          gym_id?: string
          id?: string
          key?: string
          start_date?: string
          target_classes?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["comm_channel"]
          created_at: string
          error: string | null
          gym_id: string
          id: string
          provider_id: string | null
          recipient_id: string | null
          recipient_kind: string | null
          rule_key: Database["public"]["Enums"]["automation_rule_key"] | null
          status: Database["public"]["Enums"]["comm_status"]
          subject: string | null
          to_address: string
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["comm_channel"]
          created_at?: string
          error?: string | null
          gym_id: string
          id?: string
          provider_id?: string | null
          recipient_id?: string | null
          recipient_kind?: string | null
          rule_key?: Database["public"]["Enums"]["automation_rule_key"] | null
          status?: Database["public"]["Enums"]["comm_status"]
          subject?: string | null
          to_address: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["comm_channel"]
          created_at?: string
          error?: string | null
          gym_id?: string
          id?: string
          provider_id?: string | null
          recipient_id?: string | null
          recipient_kind?: string | null
          rule_key?: Database["public"]["Enums"]["automation_rule_key"] | null
          status?: Database["public"]["Enums"]["comm_status"]
          subject?: string | null
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      class_bookings: {
        Row: {
          id: string
          class_id: string
          student_id: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          student_id: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          student_id?: string
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_bookings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          id: string
          gym_id: string
          title: string
          instructor_name: string
          day_of_week: number
          start_time: string
          end_time: string
          capacity: number
          is_recurring: boolean
          created_at: string
        }
        Insert: {
          id?: string
          gym_id: string
          title: string
          instructor_name?: string
          day_of_week: number
          start_time: string
          end_time: string
          capacity?: number
          is_recurring?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          gym_id?: string
          title?: string
          instructor_name?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          capacity?: number
          is_recurring?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          student_id: string
        }
        Insert: {
          conversation_id: string
          student_id: string
        }
        Update: {
          conversation_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      family_accounts: {
        Row: {
          created_at: string
          gym_id: string
          head_student_id: string | null
          id: string
          notes: string | null
          parent_email: string | null
          parent_name: string
          parent_phone: string | null
          shared_billing: boolean
        }
        Insert: {
          created_at?: string
          gym_id: string
          head_student_id?: string | null
          id?: string
          notes?: string | null
          parent_email?: string | null
          parent_name: string
          parent_phone?: string | null
          shared_billing?: boolean
        }
        Update: {
          created_at?: string
          gym_id?: string
          head_student_id?: string | null
          id?: string
          notes?: string | null
          parent_email?: string | null
          parent_name?: string
          parent_phone?: string | null
          shared_billing?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "family_accounts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_accounts_head_student_id_fkey"
            columns: ["head_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          free_class_nudge_after: number
          google_review_url: string | null
          id: string
          logo_bg_color: string
          logo_url: string | null
          name: string
          onboarding_completed: boolean
          owner_user_id: string | null
          phone: string | null
          primary_color: string
          secondary_color: string
          accent_color: string
          slug: string
          timezone: string
          webhook_last_test_at: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          free_class_nudge_after?: number
          google_review_url?: string | null
          id?: string
          logo_bg_color?: string
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean
          owner_user_id?: string | null
          phone?: string | null
          primary_color?: string
          secondary_color?: string
          accent_color?: string
          slug: string
          timezone?: string
          webhook_last_test_at?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          free_class_nudge_after?: number
          google_review_url?: string | null
          id?: string
          logo_bg_color?: string
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean
          owner_user_id?: string | null
          phone?: string | null
          primary_color?: string
          secondary_color?: string
          accent_color?: string
          slug?: string
          timezone?: string
          webhook_last_test_at?: string | null
        }
        Relationships: []
      }
      instructional_purchases: {
        Row: {
          amount_cents: number
          created_at: string
          gym_id: string
          id: string
          instructional_id: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          student_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          gym_id: string
          id?: string
          instructional_id: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          student_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          gym_id?: string
          id?: string
          instructional_id?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructional_purchases_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructional_purchases_instructional_id_fkey"
            columns: ["instructional_id"]
            isOneToOne: false
            referencedRelation: "instructionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructional_purchases_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      instructionals: {
        Row: {
          category: string
          coach_id: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          gym_id: string
          id: string
          is_free: boolean
          price_cents: number
          published_at: string | null
          sort_order: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          thumbnail_url: string | null
          title: string
          video_url: string
          visibility: string
        }
        Insert: {
          category?: string
          coach_id?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          gym_id: string
          id?: string
          is_free?: boolean
          price_cents?: number
          published_at?: string | null
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          thumbnail_url?: string | null
          title: string
          video_url: string
          visibility?: string
        }
        Update: {
          category?: string
          coach_id?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          gym_id?: string
          id?: string
          is_free?: boolean
          price_cents?: number
          published_at?: string | null
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          thumbnail_url?: string | null
          title?: string
          video_url?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructionals_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          email: string | null
          gym_id: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
        }
        Insert: {
          created_at?: string
          email?: string | null
          gym_id: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
        }
        Update: {
          created_at?: string
          email?: string | null
          gym_id?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
        }
        Relationships: [
          {
            foreignKeyName: "leads_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          created_at: string
          description: string | null
          gym_id: string
          id: string
          interval: Database["public"]["Enums"]["membership_interval"]
          name: string
          price_cents: number
          stripe_price_id: string | null
          stripe_product_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          gym_id: string
          id?: string
          interval?: Database["public"]["Enums"]["membership_interval"]
          name: string
          price_cents: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          gym_id?: string
          id?: string
          interval?: Database["public"]["Enums"]["membership_interval"]
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          custom_price_cents: number | null
          id: string
          plan_id: string
          start_date: string
          status: Database["public"]["Enums"]["membership_status"]
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          student_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          custom_price_cents?: number | null
          id?: string
          plan_id: string
          start_date?: string
          status?: Database["public"]["Enums"]["membership_status"]
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          student_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          custom_price_cents?: number | null
          id?: string
          plan_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["membership_status"]
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          sender_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          sender_type: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          sender_type?: string
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
      products: {
        Row: {
          class_credits: number
          created_at: string
          description: string | null
          gym_id: string
          id: string
          max_quantity: number | null
          name: string
          original_price_cents: number | null
          price_cents: number
          product_type: string
          sort_order: number
          special_end_date: string | null
          special_start_date: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          validity_days: number | null
          visible: boolean
        }
        Insert: {
          class_credits?: number
          created_at?: string
          description?: string | null
          gym_id: string
          id?: string
          max_quantity?: number | null
          name: string
          original_price_cents?: number | null
          price_cents?: number
          product_type: string
          sort_order?: number
          special_end_date?: string | null
          special_start_date?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          validity_days?: number | null
          visible?: boolean
        }
        Update: {
          class_credits?: number
          created_at?: string
          description?: string | null
          gym_id?: string
          id?: string
          max_quantity?: number | null
          name?: string
          original_price_cents?: number | null
          price_cents?: number
          product_type?: string
          sort_order?: number
          special_end_date?: string | null
          special_start_date?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          validity_days?: number | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          gym_id: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          gym_id?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          full_name?: string | null
          gym_id?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount_cents: number
          created_at: string
          credits_granted: number
          expires_at: string | null
          gym_id: string
          id: string
          notes: string | null
          product_id: string | null
          quantity: number
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          student_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          credits_granted?: number
          expires_at?: string | null
          gym_id: string
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          student_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credits_granted?: number
          expires_at?: string | null
          gym_id?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_auth: {
        Row: {
          auth_user_id: string
          created_at: string
          student_id: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          student_id: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_auth_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_badges: {
        Row: {
          badge_key: string
          earned_at: string
          id: string
          meta: Json
          student_id: string
        }
        Insert: {
          badge_key: string
          earned_at?: string
          id?: string
          meta?: Json
          student_id: string
        }
        Update: {
          badge_key?: string
          earned_at?: string
          id?: string
          meta?: Json
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_credits: {
        Row: {
          class_credits: number
          gift_card_balance_cents: number
          student_id: string
          updated_at: string
        }
        Insert: {
          class_credits?: number
          gift_card_balance_cents?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          class_credits?: number
          gift_card_balance_cents?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_credits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_goals: {
        Row: {
          student_id: string
          updated_at: string
          weekly_target: number
        }
        Insert: {
          student_id: string
          updated_at?: string
          weekly_target?: number
        }
        Update: {
          student_id?: string
          updated_at?: string
          weekly_target?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          belt_rank: Database["public"]["Enums"]["belt_rank"]
          created_at: string
          custom_monthly_price_cents: number | null
          date_of_birth: string | null
          email: string | null
          family_account_id: string | null
          full_name: string
          gym_id: string
          id: string
          is_adult: boolean
          join_date: string
          lead_id: string | null
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["student_status"]
          stripe_customer_id: string | null
        }
        Insert: {
          belt_rank?: Database["public"]["Enums"]["belt_rank"]
          created_at?: string
          custom_monthly_price_cents?: number | null
          date_of_birth?: string | null
          email?: string | null
          family_account_id?: string | null
          full_name: string
          gym_id: string
          id?: string
          is_adult?: boolean
          join_date?: string
          lead_id?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          stripe_customer_id?: string | null
        }
        Update: {
          belt_rank?: Database["public"]["Enums"]["belt_rank"]
          created_at?: string
          custom_monthly_price_cents?: number | null
          date_of_birth?: string | null
          email?: string | null
          family_account_id?: string | null
          full_name?: string
          gym_id?: string
          id?: string
          is_adult?: boolean
          join_date?: string
          lead_id?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          stripe_customer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_family_account_id_fkey"
            columns: ["family_account_id"]
            isOneToOne: false
            referencedRelation: "family_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_gyms: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_gyms_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      waivers: {
        Row: {
          id: string
          ip_address: string | null
          pdf_url: string | null
          signature_data: string | null
          signed_at: string
          signed_by_name: string | null
          student_id: string
          waiver_type: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          pdf_url?: string | null
          signature_data?: string | null
          signed_at?: string
          signed_by_name?: string | null
          student_id: string
          waiver_type?: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          pdf_url?: string | null
          signature_data?: string | null
          signed_at?: string
          signed_by_name?: string | null
          student_id?: string
          waiver_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "waivers_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_progress: {
        Row: {
          completed: boolean
          completed_pct: number
          instructional_id: string
          last_watched_at: string
          position_seconds: number
          student_id: string
        }
        Insert: {
          completed?: boolean
          completed_pct?: number
          instructional_id: string
          last_watched_at?: string
          position_seconds?: number
          student_id: string
        }
        Update: {
          completed?: boolean
          completed_pct?: number
          instructional_id?: string
          last_watched_at?: string
          position_seconds?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_progress_instructional_id_fkey"
            columns: ["instructional_id"]
            isOneToOne: false
            referencedRelation: "instructionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_role_name: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      current_student_id: { Args: never; Returns: string }
      user_gym_id: { Args: never; Returns: string }
      user_gym_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      automation_rule_key:
        | "new_lead_welcome"
        | "no_show_follow_up"
        | "re_engagement"
        | "fourth_class"
        | "ten_visits"
      belt_rank:
        | "white"
        | "gray"
        | "yellow"
        | "orange"
        | "green"
        | "blue"
        | "purple"
        | "brown"
        | "black"
      comm_channel: "email" | "sms"
      comm_status: "queued" | "sent" | "delivered" | "failed" | "simulated"
      lead_status:
        | "new"
        | "contacted"
        | "trial_scheduled"
        | "trial_completed"
        | "converted"
        | "lost"
      membership_interval: "week" | "month" | "year" | "quarter"
      membership_status:
        | "active"
        | "past_due"
        | "canceled"
        | "trialing"
        | "paused"
      student_status: "active" | "paused" | "cancelled" | "trial"
      user_role: "owner" | "admin" | "instructor" | "front_desk"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      automation_rule_key: [
        "new_lead_welcome",
        "no_show_follow_up",
        "re_engagement",
        "fourth_class",
        "ten_visits",
      ],
      belt_rank: [
        "white",
        "gray",
        "yellow",
        "orange",
        "green",
        "blue",
        "purple",
        "brown",
        "black",
      ],
      comm_channel: ["email", "sms"],
      comm_status: ["queued", "sent", "delivered", "failed", "simulated"],
      lead_status: [
        "new",
        "contacted",
        "trial_scheduled",
        "trial_completed",
        "converted",
        "lost",
      ],
      membership_interval: ["week", "month", "year", "quarter"],
      membership_status: [
        "active",
        "past_due",
        "canceled",
        "trialing",
        "paused",
      ],
      student_status: ["active", "paused", "cancelled", "trial"],
      user_role: ["owner", "admin", "instructor", "front_desk"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

// ─── Backward-compatible type aliases (DO NOT REMOVE) ────────────────────────
export type UserRole          = Database["public"]["Enums"]["user_role"];
export type BeltRank          = Database["public"]["Enums"]["belt_rank"];
export type LeadStatus        = Database["public"]["Enums"]["lead_status"];
export type StudentStatus     = Database["public"]["Enums"]["student_status"];
export type MembershipInterval = Database["public"]["Enums"]["membership_interval"];
export type MembershipStatus  = Database["public"]["Enums"]["membership_status"];
export type CommChannel       = Database["public"]["Enums"]["comm_channel"];
export type CommStatus        = Database["public"]["Enums"]["comm_status"];
export type AutomationRuleKey = Database["public"]["Enums"]["automation_rule_key"];

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };
