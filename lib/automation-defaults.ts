import type { AutomationRuleKey } from "@/lib/supabase/types";

export type RuleDefinition = {
  key: AutomationRuleKey;
  name: string;
  trigger: string;
  description: string;
  default_enabled: boolean;
  default_channel_email: boolean;
  default_channel_sms: boolean;
  default_email_subject: string;
  default_email_body: string;
  default_sms_body: string;
  default_delay_minutes: number;
  /** Variables the UI should advertise as "available" for this rule. */
  available_vars: string[];
};

export const RULE_DEFINITIONS: RuleDefinition[] = [
  {
    key: "new_lead_welcome",
    name: "New Lead Welcome",
    trigger: "Lead is created",
    description:
      "Greet new prospects the moment they hit your form and invite them to claim a free intro class.",
    default_enabled: false,
    default_channel_email: true,
    default_channel_sms: true,
    default_email_subject: "Welcome to {{gym_name}}!",
    default_email_body: `Hi {{first_name}},

Thanks for reaching out to {{gym_name}}! We'd love to have you on the mats.

Your free 30-minute intro class is ready — claim it here:
{{intro_link}}

Bring comfortable clothes, no experience needed. Our coaches will walk you through fundamentals and answer any questions.

See you soon,
The {{gym_name}} team`,
    default_sms_body:
      "Hi {{first_name}}, this is {{gym_name}}. Welcome aboard! Claim your free intro class here: {{intro_link}}",
    default_delay_minutes: 0,
    available_vars: ["gym_name", "student_name", "first_name", "intro_link"],
  },
  {
    key: "no_show_follow_up",
    name: "No-Show Follow-up",
    trigger: "Student misses a scheduled class",
    description:
      "Send a friendly text a few hours after a missed class, offering to reschedule.",
    default_enabled: false,
    default_channel_email: false,
    default_channel_sms: true,
    default_email_subject: "We missed you in {{class_name}}",
    default_email_body: `Hi {{first_name}},

We noticed you weren't able to make {{class_name}} today — happens to all of us.

Reply to this email and we'll get you on the schedule for a class that works better.

— The {{gym_name}} team`,
    default_sms_body:
      "Hey {{first_name}}, missed you at {{class_name}} today! Want to reschedule? Just reply to this text. — {{gym_name}}",
    default_delay_minutes: 240, // 4 hours
    available_vars: [
      "gym_name",
      "student_name",
      "first_name",
      "class_name",
    ],
  },
  {
    key: "re_engagement",
    name: "Re-engagement",
    trigger: "Student has no check-in for 14+ days",
    description:
      "Reach out to members who've drifted away with a special offer or gentle nudge.",
    default_enabled: false,
    default_channel_email: true,
    default_channel_sms: true,
    default_email_subject: "We miss you on the mats, {{first_name}}",
    default_email_body: `Hi {{first_name}},

It's been {{days_since}} days since we last saw you at {{gym_name}} and we wanted to check in.

{{offer}}

The mats are waiting whenever you're ready — reply and we'll get you on the schedule.

— The {{gym_name}} team`,
    default_sms_body:
      "Hi {{first_name}}, it's {{gym_name}}. Been {{days_since}} days — we'd love to see you back on the mats. {{offer}}",
    default_delay_minutes: 0,
    available_vars: [
      "gym_name",
      "student_name",
      "first_name",
      "days_since",
      "offer",
    ],
  },
  {
    key: "fourth_class",
    name: "Free Class Nudge",
    trigger: "Student completes their free class threshold",
    description:
      "Fires after a prospect finishes their configured number of free classes. Send a special offer link to convert them to a paying member.",
    default_enabled: false,
    default_channel_email: true,
    default_channel_sms: true,
    default_email_subject: "You're hooked, {{first_name}} — here's a special offer",
    default_email_body: `Hi {{first_name}},

You've just finished your free classes at {{gym_name}} — and we hope you loved it.

We'd love to keep you on the mats. Here's a special offer just for you:
{{offer_link}}

Spots are limited — grab yours before it expires.

— The {{gym_name}} team`,
    default_sms_body:
      "Hey {{first_name}}, you've finished your free classes at {{gym_name}}! We have a special offer waiting: {{offer_link}}",
    default_delay_minutes: 0,
    available_vars: ["gym_name", "student_name", "first_name", "offer_link"],
  },
  {
    key: "ten_visits",
    name: "10-Visit Milestone",
    trigger: "Student reaches 10 total check-ins",
    description:
      "Celebrate the 10th visit milestone and ask for a Google review while motivation is high.",
    default_enabled: false,
    default_channel_email: true,
    default_channel_sms: true,
    default_email_subject: "10 classes in — you're on a roll, {{first_name}}!",
    default_email_body: `Hi {{first_name}},

10 classes at {{gym_name}} — that's a real commitment and we're proud of you for showing up.

If you're enjoying your training, we'd love it if you shared your experience:
{{review_link}}

It helps us grow and reach more people who want to start their journey.

— The {{gym_name}} team`,
    default_sms_body:
      "Hey {{first_name}}, 10 classes at {{gym_name}} — amazing work! Mind leaving us a quick review? {{review_link}}",
    default_delay_minutes: 0,
    available_vars: ["gym_name", "student_name", "first_name", "review_link"],
  },
];

export const RULE_BY_KEY: Record<AutomationRuleKey, RuleDefinition> =
  Object.fromEntries(RULE_DEFINITIONS.map((r) => [r.key, r])) as Record<
    AutomationRuleKey,
    RuleDefinition
  >;

/**
 * Sample variable values used for previews and test sends, so the user can
 * see how a rendered message will look without needing real recipient data.
 */
export const PREVIEW_VARS: Record<string, string> = {
  gym_name: "Asbury Park Jiu-Jitsu",
  student_name: "Carlos Silva",
  first_name: "Carlos",
  class_name: "Tuesday 7pm Adult No-Gi",
  intro_link: "https://matflow.app/intro/abc123",
  offer: "Come back this week and your first class is on us.",
  days_since: "21",
  offer_link: "https://matflow.app/offer/abc123",
  review_link: "https://g.page/r/abc123/review",
};
