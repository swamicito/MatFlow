"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  resetRuleToDefault,
  saveRule,
  sendTestForRule,
  type AutomationState,
  type CommunicationRow,
  type RuleRow,
} from "@/app/(dashboard)/settings/automation/actions";
import { RULE_BY_KEY, PREVIEW_VARS } from "@/lib/automation-defaults";
import { renderTemplate } from "@/lib/templates";
import type {
  AutomationRuleKey,
  CommStatus,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const RULE_ICONS: Record<AutomationRuleKey, React.ComponentType<{ className?: string }>> = {
  new_lead_welcome: Sparkles,
  no_show_follow_up: Bell,
  re_engagement: RefreshCw,
  fourth_class: Zap,
  ten_visits: Zap,
};

export function AutomationClient({ initial }: { initial: AutomationState }) {
  const [state, setState] = useState<AutomationState>(initial);

  function patchRule(key: AutomationRuleKey, patch: Partial<RuleRow>) {
    setState((prev) => ({
      ...prev,
      rules: prev.rules.map((r) =>
        r.rule_key === key ? { ...r, ...patch } : r,
      ),
    }));
  }

  function prependComm(row: CommunicationRow) {
    setState((prev) => ({
      ...prev,
      recent: [row, ...prev.recent].slice(0, 20),
    }));
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Automation
          </h1>
          <p className="text-sm text-[#aaa] mt-1">
            Automated SMS + email sequences that fire when a lead, no-show, or
            quiet member is detected.
          </p>
        </div>
        <ProviderStatus
          email={state.providers.email}
          sms={state.providers.sms}
        />
      </header>

      <section className="space-y-4">
        {state.rules.map((rule) => (
          <RuleCard
            key={rule.rule_key}
            rule={rule}
            freeClassNudgeAfter={state.freeClassNudgeAfter}
            onPatch={(p) => patchRule(rule.rule_key, p)}
            onSent={prependComm}
          />
        ))}
      </section>

      <ActivityLog rows={state.recent} />
    </div>
  );
}

// ─────────────────── Provider status badge ───────────────────

function ProviderStatus({ email, sms }: { email: boolean; sms: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest">
      <Pill
        label={`Email · ${email ? "Live" : "Simulated"}`}
        tone={email ? "ok" : "warn"}
        icon={Mail}
      />
      <Pill
        label={`SMS · ${sms ? "Live" : "Simulated"}`}
        tone={sms ? "ok" : "warn"}
        icon={MessageSquare}
      />
    </div>
  );
}

function Pill({
  label,
  tone,
  icon: Icon,
}: {
  label: string;
  tone: "ok" | "warn" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : tone === "warn"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : "border-[#222] bg-black text-[#aaa]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ─────────────────── Rule card ───────────────────

function RuleCard({
  rule,
  freeClassNudgeAfter,
  onPatch,
  onSent,
}: {
  rule: RuleRow;
  freeClassNudgeAfter: number;
  onPatch: (p: Partial<RuleRow>) => void;
  onSent: (row: CommunicationRow) => void;
}) {
  const baseDef = RULE_BY_KEY[rule.rule_key];
  const def = rule.rule_key === "fourth_class"
    ? {
        ...baseDef,
        name: "Free Class Nudge",
        trigger: `Student completes ${freeClassNudgeAfter} free class${freeClassNudgeAfter === 1 ? "" : "es"}`,
      }
    : baseDef;
  const Icon = RULE_ICONS[rule.rule_key];
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  // Local edit state — only flushes to server on Save.
  const [emailSubject, setEmailSubject] = useState(rule.email_subject);
  const [emailBody, setEmailBody] = useState(rule.email_body);
  const [smsBody, setSmsBody] = useState(rule.sms_body);
  const [delay, setDelay] = useState(rule.delay_minutes);

  const dirty =
    emailSubject !== rule.email_subject ||
    emailBody !== rule.email_body ||
    smsBody !== rule.sms_body ||
    delay !== rule.delay_minutes;

  function toggleEnabled() {
    const next = !rule.enabled;
    onPatch({ enabled: next });
    startTransition(async () => {
      const r = await saveRule({ rule_key: rule.rule_key, enabled: next });
      if (!r.ok) {
        toast.error("Couldn't toggle rule", { description: r.error });
        onPatch({ enabled: !next });
        return;
      }
      toast.success(next ? "Rule enabled" : "Rule disabled");
    });
  }

  function setChannel(channel: "email" | "sms", on: boolean) {
    const patch =
      channel === "email"
        ? { channel_email: on }
        : { channel_sms: on };
    onPatch(patch);
    startTransition(async () => {
      const r = await saveRule({ rule_key: rule.rule_key, ...patch });
      if (!r.ok) {
        toast.error("Couldn't update channels", { description: r.error });
        onPatch(
          channel === "email"
            ? { channel_email: !on }
            : { channel_sms: !on },
        );
      }
    });
  }

  function saveTemplates() {
    startTransition(async () => {
      const r = await saveRule({
        rule_key: rule.rule_key,
        email_subject: emailSubject,
        email_body: emailBody,
        sms_body: smsBody,
        delay_minutes: delay,
      });
      if (!r.ok) {
        toast.error("Couldn't save templates", { description: r.error });
        return;
      }
      onPatch({
        email_subject: emailSubject,
        email_body: emailBody,
        sms_body: smsBody,
        delay_minutes: delay,
      });
      toast.success("Templates saved");
    });
  }

  function resetToDefaults() {
    startTransition(async () => {
      const r = await resetRuleToDefault(rule.rule_key);
      if (!r.ok) {
        toast.error("Couldn't reset", { description: r.error });
        return;
      }
      toast.success("Reset to defaults");
      router.refresh();
    });
  }

  return (
    <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
      <CardContent className="p-0">
        {/* Header row */}
        <div className="px-6 py-4 flex items-start gap-4 flex-wrap">
          <div className="h-10 w-10 grid place-items-center rounded-md border border-[#222] bg-black text-white shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-white">
                {def.name}
              </h3>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                  rule.enabled
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                    : "border-[#222] bg-black text-[#888]",
                )}
              >
                <Zap className="h-3 w-3" />
                {rule.enabled ? "Active" : "Paused"}
              </span>
            </div>
            <p className="text-xs uppercase tracking-widest text-[#666] mt-1">
              When · {def.trigger}
            </p>
            <p className="text-sm text-[#aaa] mt-2 leading-relaxed">
              {def.description}
            </p>
          </div>
          <Toggle
            checked={rule.enabled}
            onChange={toggleEnabled}
            pending={pending}
          />
        </div>

        {/* Channel row */}
        <div className="px-6 pb-4 flex items-center gap-3 flex-wrap border-t border-[#161616] pt-4">
          <Label className="text-xs uppercase tracking-widest text-[#888] mr-1">
            Channels
          </Label>
          <ChannelChip
            label="Email"
            icon={Mail}
            active={rule.channel_email}
            onClick={() => setChannel("email", !rule.channel_email)}
          />
          <ChannelChip
            label="SMS"
            icon={MessageSquare}
            active={rule.channel_sms}
            onClick={() => setChannel("sms", !rule.channel_sms)}
          />
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(true)}
              className="h-8 border-[#222] bg-transparent text-[#ccc] hover:bg-[#111] hover:text-white"
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTestOpen(true)}
              className="h-8 border-[#222] bg-transparent text-[#ccc] hover:bg-[#111] hover:text-white"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Test Send
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              className="h-8 text-[#aaa] hover:text-white hover:bg-[#111]"
            >
              {expanded ? "Hide template" : "Edit template"}
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5 ml-1.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Editor */}
        {expanded && (
          <div className="px-6 pb-6 border-t border-[#161616] pt-5 space-y-5">
            <VarsLegend vars={def.available_vars} />

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-[#888]">
                Email Subject
              </Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="bg-black border-[#222] text-white"
                disabled={!rule.channel_email}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-[#888]">
                Email Body
              </Label>
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={8}
                className="bg-black border-[#222] text-white font-mono text-sm"
                disabled={!rule.channel_email}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-[#888] flex items-center justify-between">
                <span>SMS Body</span>
                <span className="text-[10px] text-[#666]">
                  {smsBody.length} chars
                </span>
              </Label>
              <Textarea
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                rows={3}
                className="bg-black border-[#222] text-white font-mono text-sm"
                disabled={!rule.channel_sms}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-[#888]">
                Delay (minutes after trigger)
              </Label>
              <Input
                type="number"
                min={0}
                value={delay}
                onChange={(e) => setDelay(Number(e.target.value) || 0)}
                className="bg-black border-[#222] text-white w-32 tabular-nums"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={saveTemplates}
                disabled={pending || !dirty}
                className="bg-white text-black hover:bg-white/90 disabled:opacity-50"
              >
                {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Templates
              </Button>
              <Button
                variant="ghost"
                onClick={resetToDefaults}
                disabled={pending}
                className="text-[#888] hover:text-white hover:bg-[#111]"
              >
                Reset to defaults
              </Button>
              {dirty && (
                <span className="text-xs text-amber-300/80">
                  Unsaved changes
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <PreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        rule={{
          ...rule,
          email_subject: emailSubject,
          email_body: emailBody,
          sms_body: smsBody,
        }}
      />

      <TestSendDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        rule={rule}
        onSent={onSent}
      />
    </Card>
  );
}

// ─────────────────── Small bits ───────────────────

function Toggle({
  checked,
  onChange,
  pending,
}: {
  checked: boolean;
  onChange: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={pending}
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 rounded-full border transition-colors shrink-0",
        checked
          ? "bg-white border-white"
          : "bg-[#0a0a0a] border-[#333]",
        pending && "opacity-60",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full transition-all",
          checked
            ? "left-[22px] bg-black"
            : "left-0.5 bg-[#444]",
        )}
      />
    </button>
  );
}

function ChannelChip({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 h-7 text-xs transition-colors",
        active
          ? "border-white bg-white text-black"
          : "border-[#222] bg-black text-[#aaa] hover:text-white hover:border-[#333]",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function VarsLegend({ vars }: { vars: string[] }) {
  return (
    <div className="rounded-md border border-[#1f1f1f] bg-black px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-[#666] mb-1.5">
        Available variables · click to copy
      </p>
      <div className="flex flex-wrap gap-1.5">
        {vars.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              const token = `{{${v}}}`;
              navigator.clipboard.writeText(token).then(
                () => toast.success(`Copied ${token}`),
                () => toast.error("Couldn't copy"),
              );
            }}
            className="inline-flex items-center gap-1 rounded border border-[#222] bg-[#0a0a0a] px-2 py-0.5 text-[11px] font-mono text-white hover:bg-[#111]"
          >
            {`{{${v}}}`}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────── Preview dialog ───────────────────

function PreviewDialog({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rule: RuleRow;
}) {
  const def = RULE_BY_KEY[rule.rule_key];
  const subject = useMemo(
    () => renderTemplate(rule.email_subject, PREVIEW_VARS),
    [rule.email_subject],
  );
  const emailBody = useMemo(
    () => renderTemplate(rule.email_body, PREVIEW_VARS),
    [rule.email_body],
  );
  const smsBody = useMemo(
    () => renderTemplate(rule.sms_body, PREVIEW_VARS),
    [rule.sms_body],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preview · {def.name}</DialogTitle>
          <DialogDescription className="text-[#888]">
            Rendered with sample variables (Carlos · Method Jiu-Jitsu).
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={rule.channel_email ? "email" : "sms"}>
          <TabsList className="bg-black border border-[#222]">
            <TabsTrigger value="email" disabled={!rule.channel_email}>
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Email
            </TabsTrigger>
            <TabsTrigger value="sms" disabled={!rule.channel_sms}>
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              SMS
            </TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="mt-4">
            <div className="rounded-md border border-[#1f1f1f] bg-black">
              <div className="px-4 py-3 border-b border-[#1f1f1f]">
                <p className="text-[10px] uppercase tracking-widest text-[#666]">
                  Subject
                </p>
                <p className="text-sm text-white">{subject}</p>
              </div>
              <pre className="px-4 py-4 text-sm text-[#ccc] whitespace-pre-wrap font-sans leading-relaxed max-h-[50vh] overflow-y-auto">
                {emailBody}
              </pre>
            </div>
          </TabsContent>
          <TabsContent value="sms" className="mt-4">
            <div className="mx-auto max-w-sm rounded-2xl border border-[#1f1f1f] bg-black p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-[#666] text-center">
                SMS · {smsBody.length} chars
              </p>
              <div className="rounded-2xl bg-[#0a84ff] text-white px-4 py-3 text-sm leading-relaxed">
                {smsBody}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────── Test send dialog ───────────────────

function TestSendDialog({
  open,
  onOpenChange,
  rule,
  onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rule: RuleRow;
  onSent: (row: CommunicationRow) => void;
}) {
  const def = RULE_BY_KEY[rule.rule_key];
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const r = await sendTestForRule({
        rule_key: rule.rule_key,
        to_email: rule.channel_email && email ? email : null,
        to_phone: rule.channel_sms && phone ? phone : null,
      });
      if (!r.ok) {
        toast.error("Test send failed", { description: r.error });
        return;
      }
      const lines: string[] = [];
      if (r.result.email) {
        lines.push(`Email · ${r.result.email.status}`);
        const now = new Date().toISOString();
        onSent({
          id: `local-${Math.random()}`,
          rule_key: rule.rule_key,
          channel: "email",
          status: r.result.email.status,
          to_address: email,
          subject: renderTemplate(rule.email_subject, PREVIEW_VARS),
          body: renderTemplate(rule.email_body, PREVIEW_VARS),
          error: r.result.email.error,
          created_at: now,
        });
      }
      if (r.result.sms) {
        lines.push(`SMS · ${r.result.sms.status}`);
        const now = new Date().toISOString();
        onSent({
          id: `local-${Math.random()}-sms`,
          rule_key: rule.rule_key,
          channel: "sms",
          status: r.result.sms.status,
          to_address: phone,
          subject: null,
          body: renderTemplate(rule.sms_body, PREVIEW_VARS),
          error: r.result.sms.error,
          created_at: now,
        });
      }
      toast.success("Test send complete", { description: lines.join(" · ") });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Test send · {def.name}</DialogTitle>
          <DialogDescription className="text-[#888]">
            Sends the rendered template using the configured providers. If
            keys aren&apos;t set, the message is logged as{" "}
            <code className="font-mono">simulated</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {rule.channel_email && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-[#888]">
                Email recipient
              </Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-black border-[#222] text-white"
              />
            </div>
          )}
          {rule.channel_sms && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-[#888]">
                SMS recipient
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+15551234567"
                className="bg-black border-[#222] text-white"
              />
            </div>
          )}
          {!rule.channel_email && !rule.channel_sms && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2 text-sm text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              Enable at least one channel before testing.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="text-[#aaa] hover:text-white hover:bg-[#111]"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              pending ||
              (!rule.channel_email && !rule.channel_sms) ||
              (rule.channel_email && !email && !rule.channel_sms) ||
              (rule.channel_sms && !phone && !rule.channel_email) ||
              (rule.channel_email &&
                rule.channel_sms &&
                !email &&
                !phone)
            }
            className="bg-white text-black hover:bg-white/90"
          >
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Send className="h-4 w-4 mr-2" />
            Send Test
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────── Activity log ───────────────────

function ActivityLog({ rows }: { rows: CommunicationRow[] }) {
  return (
    <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
      <CardContent className="p-0">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-base font-medium text-white">Recent Activity</h2>
          <span className="text-[10px] uppercase tracking-widest text-[#666]">
            Last 20 messages
          </span>
        </div>
        {rows.length === 0 ? (
          <div className="px-6 pb-6">
            <div className="rounded-md border border-dashed border-[#222] bg-black px-4 py-8 text-center text-sm text-[#aaa]">
              No messages sent yet. Click <span className="text-white">Test Send</span>{" "}
              on any rule to log your first activity.
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-[#161616]">
            {rows.map((r) => (
              <ActivityRow key={r.id} row={r} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityRow({ row }: { row: CommunicationRow }) {
  const ChannelIcon = row.channel === "email" ? Mail : MessageSquare;
  const ruleName = row.rule_key
    ? RULE_BY_KEY[row.rule_key]?.name ?? row.rule_key
    : "Manual";
  return (
    <li className="px-6 py-3 flex items-start gap-4 hover:bg-black/30">
      <div className="h-8 w-8 grid place-items-center rounded-md border border-[#222] bg-black text-[#ccc] shrink-0">
        <ChannelIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-white truncate">{ruleName}</span>
          <StatusBadge status={row.status} />
          <span className="text-xs text-[#666] truncate">
            → {row.to_address}
          </span>
        </div>
        {row.subject && (
          <p className="text-xs text-[#aaa] mt-0.5 truncate">{row.subject}</p>
        )}
        <p className="text-xs text-[#666] mt-0.5 truncate">{row.body}</p>
        {row.error && (
          <p className="text-xs text-red-300 mt-0.5">{row.error}</p>
        )}
      </div>
      <span className="text-[11px] text-[#666] tabular-nums shrink-0">
        {new Date(row.created_at).toLocaleString()}
      </span>
    </li>
  );
}

function StatusBadge({ status }: { status: CommStatus }) {
  const map: Record<
    CommStatus,
    { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    queued: {
      label: "Queued",
      cls: "border-[#222] bg-black text-[#aaa]",
      icon: Loader2,
    },
    sent: {
      label: "Sent",
      cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
      icon: CheckCircle2,
    },
    delivered: {
      label: "Delivered",
      cls: "border-emerald-500/50 bg-emerald-500/15 text-emerald-200",
      icon: CheckCircle2,
    },
    simulated: {
      label: "Simulated",
      cls: "border-[#333] bg-[#0a0a0a] text-[#aaa]",
      icon: Eye,
    },
    failed: {
      label: "Failed",
      cls: "border-red-500/40 bg-red-500/10 text-red-300",
      icon: XCircle,
    },
  };
  const m = map[status];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
        m.cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}
