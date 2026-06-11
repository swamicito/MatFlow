// =====================================================
// MatFlow - Complete Types (Final Fix)
// =====================================================

export type MembershipInterval = 'week' | 'month' | 'quarter' | 'year';

export type BeltRank =
  | 'White' | 'Blue' | 'Purple' | 'Brown' | 'Black'
  | 'Gray' | 'Yellow' | 'Orange' | 'Green';

export type LeadStatus =
  | 'new' | 'contacted' | 'trial_scheduled' | 'trial_completed' | 'converted' | 'lost';

export type StudentStatus =
  | 'active' | 'trial' | 'paused' | 'cancelled' | 'inactive';

export type AutomationRuleKey =
  | 'new_lead_welcome'
  | 'no_show_follow_up'
  | 're_engagement'
  | 'fourth_class'
  | 'ten_visits';

export type CommStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'simulated';

export type ActionResult<T = undefined> =
  | { ok: true } & (T extends undefined ? object : { data: T })
  | { ok: false; error: string };

// =====================================================
// Full Database Type
// =====================================================

export type Database = {
  public: {
    Tables: {
      gyms: {
        Row: {
          id: string;
          name: string;
          slug: string;
          google_review_url: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      plans: {
        Row: {
          id: string;
          gym_id: string;
          name: string;
          price_cents: number;
          interval: MembershipInterval;
          stripe_product_id: string | null;
          stripe_price_id: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      students: {
        Row: {
          id: string;
          gym_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          status: StudentStatus;
          belt_rank: BeltRank | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      attendance: {
        Row: {
          id: string;
          gym_id: string;
          student_id: string;
          checked_in_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      automation_rules: {
        Row: {
          id: string;
          gym_id: string;
          rule_key: AutomationRuleKey;
          enabled: boolean;
          channel_email: boolean;
          channel_sms: boolean;
          email_subject: string | null;
          email_body: string | null;
          sms_body: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      automation_triggers: {
        Row: {
          id: string;
          gym_id: string;
          student_id: string;
          trigger_type: string;
          triggered_at: string;
          sent: boolean;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
  };
};