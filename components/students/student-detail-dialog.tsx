"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Download,
  Eye,
  Pen,
  Trash2,
  Users,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ADULT_BELTS,
  BELT_LABEL,
  BJJ_SKILLS,
  STUDENT_STATUSES,
  STUDENT_STATUS_BADGE,
  STUDENT_STATUS_LABEL,
  WAIVER_TYPES,
  computeProgressPercentage,
  formatDate,
  waiverTypeLabel,
  type WaiverType,
} from "@/lib/students";
import { BeltBadge } from "@/components/students/belt-badge";
import { StudentProgressSection } from "@/components/students/student-progress-section";
import { ShopSection } from "@/components/students/shop-section";
import { OnDemandSection } from "@/components/students/ondemand-section";
import {
  addStudentToFamily,
  createFamily,
  deleteWaiver,
  removeStudentFromFamily,
  saveWaiver,
  updateBeltProgress,
  updateFamily,
  updateStudent,
} from "@/app/(dashboard)/students/actions";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/students/signature-pad";
import {
  cancelSubscription,
  createPortalSession,
  subscribeStudent,
} from "@/app/(dashboard)/billing/actions";
import {
  INTERVAL_SHORT,
  MEMBERSHIP_STATUS_BADGE,
  MEMBERSHIP_STATUS_LABEL,
  formatMoney,
} from "@/lib/billing";
import { cn } from "@/lib/utils";
import type {
  BeltRank,
  Database,
  StudentStatus,
} from "@/lib/supabase/types";

type Student = Database["public"]["Tables"]["students"]["Row"];
type BeltProgress = Database["public"]["Tables"]["belt_progress"]["Row"];
type Membership = Database["public"]["Tables"]["memberships"]["Row"];
type Plan = Database["public"]["Tables"]["membership_plans"]["Row"];
type Family = Database["public"]["Tables"]["family_accounts"]["Row"];
type Waiver = Database["public"]["Tables"]["waivers"]["Row"];

export type FamilyMemberLite = { id: string; full_name: string };

const inputCls =
  "bg-black border-[#222] focus-visible:ring-white/40 text-white placeholder:text-[#666]";

export function StudentDetailDialog({
  student,
  progress,
  membership = null,
  plans = [],
  stripeConfigured = false,
  family = null,
  familyMembers = [],
  allFamilies = [],
  unassignedStudents = [],
  waivers = [],
  open,
  onOpenChange,
}: {
  student: Student | null;
  progress: BeltProgress | null;
  membership?: Membership | null;
  plans?: Plan[];
  stripeConfigured?: boolean;
  family?: Family | null;
  familyMembers?: FamilyMemberLite[];
  allFamilies?: Family[];
  unassignedStudents?: FamilyMemberLite[];
  waivers?: Waiver[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Info form
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<StudentStatus>("active");
  const [notes, setNotes] = useState("");

  // Belt tracker
  const [belt, setBelt] = useState<BeltRank>("white");
  const [stripes, setStripes] = useState(0);
  const [skills, setSkills] = useState<string[]>([]);

  useEffect(() => {
    if (!student) return;
    setFullName(student.full_name ?? "");
    setPhone(student.phone ?? "");
    setEmail(student.email ?? "");
    setStatus(student.status);
    setNotes(student.notes ?? "");
    setBelt((progress?.current_belt ?? student.belt_rank) as BeltRank);
    setStripes(progress?.stripes ?? 0);
    setSkills(
      Array.isArray(progress?.skills_completed)
        ? (progress!.skills_completed as string[])
        : [],
    );
    setSavedAt(null);
    setError(null);
  }, [student, progress]);

  const progressPct = useMemo(
    () => computeProgressPercentage(skills.length),
    [skills],
  );

  if (!student) return null;

  function toggleSkill(id: string) {
    setSkills((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function onSaveInfo() {
    setError(null);
    startTransition(async () => {
      const result = await updateStudent({
        id: student!.id,
        full_name: fullName,
        email,
        phone,
        status,
        notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  function onSaveBelt() {
    setError(null);
    startTransition(async () => {
      const result = await updateBeltProgress({
        student_id: student!.id,
        current_belt: belt,
        stripes,
        skills_completed: skills,
        progress_percentage: progressPct,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-2xl h-[92vh] flex flex-col p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-[#1f1f1f] sticky top-0 z-10 bg-[#0a0a0a]">
          <div className="flex items-center gap-3 flex-wrap pr-8">
            <DialogTitle className="text-xl">{student.full_name}</DialogTitle>
            <BeltBadge belt={belt} stripes={stripes} />
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                STUDENT_STATUS_BADGE[status],
              )}
            >
              {STUDENT_STATUS_LABEL[status]}
            </span>
          </div>
          <DialogDescription className="text-[#666] text-xs">
            Joined {formatDate(student.join_date)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-6 pt-4">

        {/* No-waiver warning */}
        {waivers.length === 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300">No waiver on file</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                This student has never signed a liability waiver. Use the Waivers section below to collect a signature before their next session.
              </p>
            </div>
          </div>
        )}

        {/* Basic info */}
        <section className="space-y-4">
          <h3 className="text-xs uppercase tracking-wider text-[#888]">
            Basic Info
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="d-full_name">Full name</Label>
              <Input
                id="d-full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => v && setStatus(v as StudentStatus)}
              >
                <SelectTrigger className="bg-black border-[#222] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white">
                  {STUDENT_STATUSES.map((s) => (
                    <SelectItem
                      key={s}
                      value={s}
                      className="focus:bg-[#111] focus:text-white"
                    >
                      {STUDENT_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="d-phone">Phone</Label>
              <Input
                id="d-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-email">Email</Label>
              <Input
                id="d-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="d-notes">Notes</Label>
            <Textarea
              id="d-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={onSaveInfo}
              disabled={pending}
              variant="outline"
              className="border-[#333] bg-transparent hover:bg-[#111] text-white"
            >
              Save Info
            </Button>
          </div>
        </section>

        <div className="h-px bg-[#1f1f1f]" />

        {/* Billing / Membership */}
        <BillingSection
          student={student}
          membership={membership}
          plans={plans}
          stripeConfigured={stripeConfigured}
        />

        <div className="h-px bg-[#1f1f1f]" />

        {/* Family */}
        <FamilySection
          student={student}
          family={family}
          familyMembers={familyMembers}
          allFamilies={allFamilies}
          unassignedStudents={unassignedStudents}
        />

        <div className="h-px bg-[#1f1f1f]" />

        {/* Waivers */}
        <WaiversSection student={student} waivers={waivers} />

        <div className="h-px bg-[#1f1f1f]" />

        {/* Progress / gamification */}
        <StudentProgressSection studentId={student.id} enabled={open} />

        <div className="h-px bg-[#1f1f1f]" />

        {/* Shop */}
        <ShopSection
          studentId={student.id}
          enabled={open}
          stripeConfigured={stripeConfigured}
        />

        <div className="h-px bg-[#1f1f1f]" />

        {/* On-Demand Instructionals */}
        <OnDemandSection
          studentId={student.id}
          enabled={open}
          stripeConfigured={stripeConfigured}
        />

        <div className="h-px bg-[#1f1f1f]" />

        {/* Belt progression */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider text-[#888]">
              Belt Progression
            </h3>
            <BeltBadge belt={belt} stripes={stripes} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Current belt</Label>
              <Select
                value={belt}
                onValueChange={(v) => v && setBelt(v as BeltRank)}
              >
                <SelectTrigger className="bg-black border-[#222] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white">
                  {ADULT_BELTS.map((b) => (
                    <SelectItem
                      key={b}
                      value={b}
                      className="focus:bg-[#111] focus:text-white"
                    >
                      {BELT_LABEL[b]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Stripes</Label>
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setStripes(n)}
                    className={cn(
                      "h-9 w-9 rounded-md border text-sm transition-colors",
                      n === stripes
                        ? "border-white bg-white text-black"
                        : "border-[#222] bg-black text-[#aaa] hover:bg-[#111] hover:text-white",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Progress</Label>
              <span className="text-sm tabular-nums text-white">
                {progressPct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#111] overflow-hidden border border-[#1f1f1f]">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-[#666]">
              Auto-computed from skills checked ({skills.length} /{" "}
              {BJJ_SKILLS.length}).
            </p>
          </div>

          <div className="space-y-2">
            <Label>Skills checklist</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BJJ_SKILLS.map((skill) => {
                const checked = skills.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => toggleSkill(skill.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      checked
                        ? "border-white/40 bg-white/5 text-white"
                        : "border-[#222] bg-black text-[#bbb] hover:bg-[#111] hover:text-white",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-4 w-4 place-items-center rounded-sm border",
                        checked
                          ? "border-white bg-white text-black"
                          : "border-[#333] bg-transparent text-transparent",
                      )}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span>{skill.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2 flex items-start gap-2">
              <X className="h-4 w-4 mt-0.5" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-[#666]">
              {savedAt ? `Last saved at ${savedAt}` : ""}
            </p>
            <Button
              onClick={onSaveBelt}
              disabled={pending}
              className="bg-white text-black hover:bg-white/90"
            >
              {pending ? "Saving..." : "Update Belt Progress"}
            </Button>
          </div>
        </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── BillingSection ─────────────────────────

function BillingSection({
  student,
  membership,
  plans,
  stripeConfigured,
}: {
  student: Student;
  membership: Membership | null;
  plans: Plan[];
  stripeConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [planId, setPlanId] = useState<string>(plans[0]?.id ?? "");
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [customDollars, setCustomDollars] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const currentPlan = membership
    ? (plans.find((p) => p.id === membership.plan_id) ?? null)
    : null;
  const effective = membership
    ? (membership.custom_price_cents ?? currentPlan?.price_cents ?? 0)
    : 0;
  const isCustom =
    membership &&
    currentPlan &&
    membership.custom_price_cents !== null &&
    membership.custom_price_cents !== currentPlan.price_cents;

  function onSubscribe() {
    setError(null);
    if (!selectedPlan) {
      setError("Pick a plan first.");
      return;
    }
    let customCents: number | null = null;
    if (useCustomPrice) {
      const v = Math.round(parseFloat(customDollars || "0") * 100);
      if (!Number.isFinite(v) || v < 0) {
        setError("Enter a valid custom price.");
        return;
      }
      customCents = v;
    }
    startTransition(async () => {
      const result = await subscribeStudent({
        student_id: student.id,
        plan_id: selectedPlan.id,
        custom_price_cents: customCents,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onCancel() {
    if (!membership) return;
    if (!confirm("Cancel this subscription at period end?")) return;
    startTransition(async () => {
      const result = await cancelSubscription(membership.id, false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onManageBilling() {
    setError(null);
    startTransition(async () => {
      const result = await createPortalSession(
        student.id,
        typeof window !== "undefined" ? window.location.href : "/",
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-[#888]">Billing</h3>
        {!stripeConfigured && (
          <span className="text-[10px] uppercase tracking-widest text-amber-300">
            Stripe not configured
          </span>
        )}
      </div>

      {membership && currentPlan ? (
        <div className="rounded-lg border border-[#1f1f1f] bg-black p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-white font-medium">{currentPlan.name}</p>
              <p className="text-sm text-[#aaa] tabular-nums">
                {formatMoney(effective)}
                <span className="text-[#666] ml-1">
                  {INTERVAL_SHORT[currentPlan.interval]}
                </span>
                {isCustom && (
                  <span className="ml-2 inline-flex items-center rounded-full border border-purple-500/40 bg-purple-500/10 text-purple-300 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                    Grandfathered
                  </span>
                )}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                MEMBERSHIP_STATUS_BADGE[membership.status],
              )}
            >
              {MEMBERSHIP_STATUS_LABEL[membership.status]}
            </span>
          </div>

          {membership.current_period_end && (() => {
            const end = new Date(membership.current_period_end);
            const daysLeft = Math.ceil(
              (end.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            );
            const verb =
              membership.cancel_at_period_end || membership.status === "canceled"
                ? "Ends"
                : membership.status === "trialing"
                  ? "Trial ends"
                  : "Renews";
            return (
              <p className="text-xs text-[#666]">
                {verb}{" "}
                {end.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {daysLeft >= 0 && daysLeft <= 30 && (
                  <span className="ml-1">
                    · {daysLeft === 0 ? "today" : `${daysLeft}d`}
                  </span>
                )}
                {membership.cancel_at_period_end && (
                  <span className="text-amber-300"> · cancels at period end</span>
                )}
              </p>
            );
          })()}

          <div className="flex gap-2 pt-1 flex-wrap">
            <Button
              onClick={onManageBilling}
              disabled={pending || !stripeConfigured}
              variant="outline"
              className="border-[#333] bg-transparent hover:bg-[#111] text-white"
            >
              Manage Billing
            </Button>
            {membership.status !== "canceled" && (
              <Button
                onClick={onCancel}
                disabled={pending}
                variant="outline"
                className="border-[#333] bg-transparent hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40 text-white"
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#222] p-4 text-sm text-[#888]">
          No plans yet. Create one in{" "}
          <a href="/billing/plans" className="text-white underline">
            Membership Plans
          </a>{" "}
          first.
        </div>
      ) : (
        <div className="rounded-lg border border-[#1f1f1f] bg-black p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select
                value={planId}
                onValueChange={(v) => v && setPlanId(v)}
              >
                <SelectTrigger className="bg-black border-[#222] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white">
                  {plans.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      className="focus:bg-[#111] focus:text-white"
                    >
                      {p.name} · {formatMoney(p.price_cents)}
                      {INTERVAL_SHORT[p.interval]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useCustomPrice}
                  onChange={(e) => setUseCustomPrice(e.target.checked)}
                  className="h-4 w-4 accent-white"
                />
                Grandfathered price
              </Label>
              <Input
                disabled={!useCustomPrice}
                type="number"
                step="0.01"
                min="0"
                value={customDollars}
                onChange={(e) => setCustomDollars(e.target.value)}
                placeholder={
                  selectedPlan
                    ? (selectedPlan.price_cents / 100).toFixed(2)
                    : "0.00"
                }
                className={cn(inputCls, !useCustomPrice && "opacity-40")}
              />
            </div>
          </div>
          <p className="text-xs text-[#666]">
            Subscribing creates a Stripe Customer (if needed) and a Subscription.
            The student will receive an invoice for their first payment.
          </p>
          {error && (
            <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              onClick={onSubscribe}
              disabled={pending || !planId || !stripeConfigured}
              className="bg-white text-black hover:bg-white/90"
            >
              {pending ? "Subscribing..." : "Assign & Subscribe"}
            </Button>
          </div>
        </div>
      )}

      {error && membership && (
        <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}
    </section>
  );
}

// ───────────────────────── FamilySection ─────────────────────────

function FamilySection({
  student,
  family,
  familyMembers,
  allFamilies,
  unassignedStudents,
}: {
  student: Student;
  family: Family | null;
  familyMembers: FamilyMemberLite[];
  allFamilies: Family[];
  unassignedStudents: FamilyMemberLite[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "join" | "create">("none");
  const [joinFamilyId, setJoinFamilyId] = useState<string>("");
  const [newFamilyName, setNewFamilyName] = useState("");
  const [sharedBilling, setSharedBilling] = useState(false);
  const [addMemberId, setAddMemberId] = useState<string>("");

  function reset() {
    setMode("none");
    setError(null);
    setJoinFamilyId("");
    setNewFamilyName("");
    setSharedBilling(false);
    setAddMemberId("");
  }

  function onJoin() {
    setError(null);
    if (!joinFamilyId) {
      setError("Pick a family to join.");
      return;
    }
    startTransition(async () => {
      const result = await addStudentToFamily(student.id, joinFamilyId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      router.refresh();
    });
  }

  function onCreate() {
    setError(null);
    if (!newFamilyName.trim()) {
      setError("Enter a family / parent name.");
      return;
    }
    startTransition(async () => {
      const result = await createFamily({
        parent_name: newFamilyName,
        shared_billing: sharedBilling,
        initial_member_ids: [student.id],
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      router.refresh();
    });
  }

  function onLeave() {
    if (!confirm("Remove this student from the family?")) return;
    startTransition(async () => {
      const result = await removeStudentFromFamily(student.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onAddExisting() {
    if (!family || !addMemberId) return;
    startTransition(async () => {
      const result = await addStudentToFamily(addMemberId, family.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAddMemberId("");
      router.refresh();
    });
  }

  function onToggleSharedBilling(next: boolean) {
    if (!family) return;
    startTransition(async () => {
      const result = await updateFamily(family.id, { shared_billing: next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (family) {
    const others = familyMembers.filter((m) => m.id !== student.id);
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider text-[#888]">Family</h3>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#aaa]">
            <Users className="h-3.5 w-3.5" />
            {familyMembers.length} member{familyMembers.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="rounded-lg border border-[#1f1f1f] bg-black p-4 space-y-3">
          <div>
            <p className="text-white font-medium">{family.parent_name}</p>
            {family.parent_phone || family.parent_email ? (
              <p className="text-sm text-[#888]">
                {family.parent_phone ?? ""}
                {family.parent_phone && family.parent_email ? " · " : ""}
                {family.parent_email ?? ""}
              </p>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm text-[#ccc]">
            <input
              type="checkbox"
              checked={family.shared_billing}
              onChange={(e) => onToggleSharedBilling(e.target.checked)}
              disabled={pending}
              className="h-4 w-4 accent-white"
            />
            Shared billing (one invoice for all members)
          </label>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-[#666]">
              Other members
            </p>
            {others.length === 0 ? (
              <p className="text-sm text-[#666]">No other members yet.</p>
            ) : (
              <ul className="space-y-1">
                {others.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between text-sm text-[#ddd]"
                  >
                    <span>{m.full_name}</span>
                    {family.head_student_id === m.id && (
                      <span className="text-[10px] uppercase tracking-widest text-[#888]">
                        Head
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {unassignedStudents.length > 0 && (
            <div className="flex items-end gap-2 pt-1">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Add existing student</Label>
                <Select
                  value={addMemberId}
                  onValueChange={(v) => v && setAddMemberId(v)}
                >
                  <SelectTrigger className="bg-black border-[#222] text-white">
                    <SelectValue placeholder="Pick a student..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white max-h-72">
                    {unassignedStudents.map((s) => (
                      <SelectItem
                        key={s.id}
                        value={s.id}
                        className="focus:bg-[#111] focus:text-white"
                      >
                        {s.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={onAddExisting}
                disabled={pending || !addMemberId}
                variant="outline"
                className="border-[#333] bg-transparent hover:bg-[#111] text-white"
              >
                <UserPlus className="h-4 w-4" />
                Add
              </Button>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={onLeave}
              disabled={pending}
              variant="outline"
              className="border-[#333] bg-transparent hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40 text-white"
            >
              <UserMinus className="h-4 w-4" />
              Remove from family
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>
      </section>
    );
  }

  // No family yet — let the user join an existing one or create a new one.
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-[#888]">Family</h3>
        <span className="text-xs text-[#666]">Not in a family</span>
      </div>

      {mode === "none" && (
        <div className="flex flex-wrap gap-2">
          {allFamilies.length > 0 && (
            <Button
              onClick={() => setMode("join")}
              variant="outline"
              className="border-[#333] bg-transparent hover:bg-[#111] text-white"
            >
              <Users className="h-4 w-4" />
              Join existing family
            </Button>
          )}
          <Button
            onClick={() => setMode("create")}
            variant="outline"
            className="border-[#333] bg-transparent hover:bg-[#111] text-white"
          >
            <UserPlus className="h-4 w-4" />
            Create new family
          </Button>
        </div>
      )}

      {mode === "join" && (
        <div className="rounded-lg border border-[#1f1f1f] bg-black p-4 space-y-3">
          <div className="space-y-1">
            <Label>Family</Label>
            <Select
              value={joinFamilyId}
              onValueChange={(v) => v && setJoinFamilyId(v)}
            >
              <SelectTrigger className="bg-black border-[#222] text-white">
                <SelectValue placeholder="Pick a family..." />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white max-h-72">
                {allFamilies.map((f) => (
                  <SelectItem
                    key={f.id}
                    value={f.id}
                    className="focus:bg-[#111] focus:text-white"
                  >
                    {f.parent_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={reset}
              className="text-[#aaa] hover:text-white hover:bg-[#111]"
            >
              Cancel
            </Button>
            <Button
              onClick={onJoin}
              disabled={pending}
              className="bg-white text-black hover:bg-white/90"
            >
              Join
            </Button>
          </div>
        </div>
      )}

      {mode === "create" && (
        <div className="rounded-lg border border-[#1f1f1f] bg-black p-4 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="new-fam-name">Family / Parent name</Label>
            <Input
              id="new-fam-name"
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
              placeholder="The Smith Family"
              className={inputCls}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#ccc]">
            <input
              type="checkbox"
              checked={sharedBilling}
              onChange={(e) => setSharedBilling(e.target.checked)}
              className="h-4 w-4 accent-white"
            />
            Shared billing
          </label>
          {error && (
            <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={reset}
              className="text-[#aaa] hover:text-white hover:bg-[#111]"
            >
              Cancel
            </Button>
            <Button
              onClick={onCreate}
              disabled={pending}
              className="bg-white text-black hover:bg-white/90"
            >
              Create &amp; Add
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

// ───────────────────────── WaiversSection ─────────────────────────

function WaiversSection({
  student,
  waivers,
}: {
  student: Student;
  waivers: Waiver[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [signOpen, setSignOpen] = useState(false);
  const [viewing, setViewing] = useState<Waiver | null>(null);
  const [waiverType, setWaiverType] = useState<WaiverType>("liability_release");
  const [signedByName, setSignedByName] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const padRef = useRef<SignaturePadHandle>(null);

  const sortedWaivers = useMemo(
    () =>
      [...waivers].sort((a, b) =>
        a.signed_at < b.signed_at ? 1 : a.signed_at > b.signed_at ? -1 : 0,
      ),
    [waivers],
  );

  function openSign() {
    setError(null);
    setHasInk(false);
    setWaiverType("liability_release");
    setSignedByName("");
    setSignOpen(true);
  }

  function onClear() {
    padRef.current?.clear();
  }

  function onSave() {
    setError(null);
    const dataUrl = padRef.current?.toDataURL();
    if (!dataUrl) {
      setError("Please sign before saving.");
      return;
    }
    startTransition(async () => {
      const result = await saveWaiver({
        student_id: student.id,
        waiver_type: waiverType,
        signature_data: dataUrl,
        signed_by_name: signedByName,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSignOpen(false);
      router.refresh();
    });
  }

  function onDelete(w: Waiver) {
    if (!confirm("Delete this signed waiver? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteWaiver(w.id);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-[#888]">Waivers</h3>
        <Button
          onClick={openSign}
          variant="outline"
          size="sm"
          className="border-[#333] bg-transparent hover:bg-[#111] text-white"
        >
          <Pen className="h-3.5 w-3.5" />
          Sign New
        </Button>
      </div>

      {sortedWaivers.length === 0 ? (
        <div className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-200 flex items-center gap-2">
          <X className="h-4 w-4" />
          No waiver on file. This student should sign before training.
        </div>
      ) : (
        <ul className="rounded-lg border border-[#1f1f1f] bg-black divide-y divide-[#1a1a1a]">
          {sortedWaivers.map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-white text-sm">
                  {waiverTypeLabel(w.waiver_type)}
                </p>
                <p className="text-xs text-[#888]">
                  Signed {formatDate(w.signed_at)}
                  {w.signed_by_name ? ` · ${w.signed_by_name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {w.pdf_url && (
                  <a
                    href={w.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="h-8 w-8 grid place-items-center rounded-md border border-[#222] text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-colors"
                    aria-label="Download signed PDF"
                    title="Download signed PDF"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  onClick={() => setViewing(w)}
                  className="h-8 w-8 grid place-items-center rounded-md border border-[#222] text-[#aaa] hover:bg-[#111] hover:text-white transition-colors"
                  aria-label="View signature"
                  title="View signature"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(w)}
                  disabled={pending}
                  className="h-8 w-8 grid place-items-center rounded-md border border-[#222] text-[#aaa] hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40 transition-colors disabled:opacity-40"
                  aria-label="Delete waiver"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Sign Waiver Modal */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sign Waiver — {student.full_name}</DialogTitle>
            <DialogDescription className="text-[#aaa]">
              Use a finger, stylus, or mouse to sign in the box below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Waiver type</Label>
                <Select
                  value={waiverType}
                  onValueChange={(v) => v && setWaiverType(v as WaiverType)}
                >
                  <SelectTrigger className="bg-black border-[#222] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white">
                    {WAIVER_TYPES.map((t) => (
                      <SelectItem
                        key={t}
                        value={t}
                        className="focus:bg-[#111] focus:text-white"
                      >
                        {waiverTypeLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signed-by">Signed by (full name)</Label>
                <Input
                  id="signed-by"
                  value={signedByName}
                  onChange={(e) => setSignedByName(e.target.value)}
                  placeholder={student.full_name}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Signature</Label>
                <button
                  type="button"
                  onClick={onClear}
                  disabled={!hasInk}
                  className="text-xs text-[#aaa] hover:text-white disabled:opacity-30"
                >
                  Clear
                </button>
              </div>
              <SignaturePad
                ref={padRef}
                heightClassName="h-56 md:h-72"
                onInkChange={setHasInk}
              />
              <p className="text-xs text-[#666]">
                By signing, the named individual acknowledges the gym&apos;s
                liability waiver and assumes responsibility for risk of
                participation.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setSignOpen(false)}
                className="text-[#aaa] hover:text-white hover:bg-[#111]"
              >
                Cancel
              </Button>
              <Button
                onClick={onSave}
                disabled={pending || !hasInk}
                className="bg-white text-black hover:bg-white/90"
              >
                <Check className="h-4 w-4" />
                {pending ? "Saving..." : "Save Signature"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Waiver Modal */}
      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {viewing ? waiverTypeLabel(viewing.waiver_type) : "Waiver"}
            </DialogTitle>
            <DialogDescription className="text-[#aaa]">
              {viewing
                ? `Signed ${formatDate(viewing.signed_at)}${
                    viewing.signed_by_name ? ` · ${viewing.signed_by_name}` : ""
                  }`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {viewing?.signature_data ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewing.signature_data}
              alt="Signature"
              className="w-full rounded-lg border border-[#222] bg-white"
            />
          ) : (
            <p className="text-sm text-[#888]">
              No signature image stored on this waiver.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
