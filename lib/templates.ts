/**
 * Tiny mustache-style template renderer for automation messages.
 * Replaces `{{var}}` with the matching value, leaves unknown variables as-is
 * (wrapped in [brackets] in the rendered output to make it obvious).
 */

export type TemplateVars = Record<string, string | number | null | undefined>;

const TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function renderTemplate(
  template: string,
  vars: TemplateVars,
): string {
  return template.replace(TOKEN, (_, key: string) => {
    const v = vars[key];
    if (v === null || v === undefined || v === "") {
      return `[${key}]`;
    }
    return String(v);
  });
}

export function extractVars(template: string): string[] {
  const matches = template.match(TOKEN) ?? [];
  return Array.from(
    new Set(matches.map((m) => m.replace(TOKEN, "$1"))),
  );
}

export const KNOWN_VARS: { key: string; description: string }[] = [
  { key: "gym_name", description: "Your academy's name." },
  { key: "student_name", description: "Recipient's full name." },
  { key: "first_name", description: "Recipient's first name." },
  { key: "class_name", description: "Class they missed (no-show only)." },
  { key: "intro_link", description: "Link to claim a free intro class." },
  { key: "offer", description: "Re-engagement special offer text." },
  { key: "days_since", description: "Days since last check-in." },
];
