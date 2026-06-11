"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Users, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LeadStatusBadge } from "@/components/leads/status-badge";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/leads";
import { updateLeadStatus } from "@/app/(dashboard)/leads/actions";
import {
  convertLeadToStudent,
  createFamily,
} from "@/app/(dashboard)/students/actions";
import type { Database, LeadStatus } from "@/lib/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Family = Database["public"]["Tables"]["family_accounts"]["Row"];

const inputCls =
  "bg-black border-[#222] focus-visible:ring-white/40 text-white placeholder:text-[#666]";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusSelect({ id, status }: { id: string; status: LeadStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(next: string | null) {
    if (!next || next === status) return;
    startTransition(async () => {
      const result = await updateLeadStatus(id, next as LeadStatus);
      if (result.ok) router.refresh();
    });
  }

  return (
    <Select value={status} onValueChange={onChange} disabled={pending}>
      <SelectTrigger
        size="sm"
        className="bg-transparent border-[#222] hover:bg-[#111] text-white w-[150px]"
      >
        <SelectValue>
          <LeadStatusBadge status={status} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white">
        {LEAD_STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="focus:bg-[#111] focus:text-white">
            {LEAD_STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ConvertButton({
  lead,
  families,
}: {
  lead: Lead;
  families: Family[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"none" | "join" | "create">("none");
  const [joinFamilyId, setJoinFamilyId] = useState<string>("");
  const [newFamilyName, setNewFamilyName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const alreadyConverted = lead.status === "converted";

  function reset() {
    setMode("none");
    setJoinFamilyId("");
    setNewFamilyName("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) reset();
  }

  function onConvert() {
    setError(null);
    startTransition(async () => {
      let familyId: string | null = null;

      if (mode === "join") {
        if (!joinFamilyId) {
          setError("Pick a family to join, or change the option above.");
          return;
        }
        familyId = joinFamilyId;
      } else if (mode === "create") {
        if (!newFamilyName.trim()) {
          setError("Enter a family / parent name.");
          return;
        }
        const famResult = await createFamily({
          parent_name: newFamilyName,
        });
        if (!famResult.ok) {
          setError(famResult.error);
          return;
        }
        familyId = famResult.data.family_id;
      }

      const result = await convertLeadToStudent(lead.id, {
        family_account_id: familyId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
      router.push("/students");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => !alreadyConverted && setOpen(true)}
        disabled={alreadyConverted || pending}
        className="text-xs text-[#aaa] hover:text-white transition-colors disabled:opacity-40 disabled:hover:text-[#aaa] disabled:cursor-not-allowed"
      >
        {alreadyConverted ? "Converted" : pending ? "Converting..." : "Convert"}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convert Lead → Student</DialogTitle>
            <DialogDescription className="text-[#aaa]">
              Create a student record for{" "}
              <span className="text-white">{lead.name}</span>. Optionally attach
              them to a family.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-[#888]">
                Family
              </Label>
              <div className="grid grid-cols-3 gap-1.5 rounded-md border border-[#222] bg-black p-1">
                <ModeChip
                  active={mode === "none"}
                  onClick={() => setMode("none")}
                  label="Individual"
                />
                <ModeChip
                  active={mode === "join"}
                  onClick={() => setMode("join")}
                  disabled={families.length === 0}
                  label="Join existing"
                  icon={<Users className="h-3.5 w-3.5" />}
                />
                <ModeChip
                  active={mode === "create"}
                  onClick={() => setMode("create")}
                  label="Create new"
                  icon={<UserPlus className="h-3.5 w-3.5" />}
                />
              </div>
            </div>

            {mode === "join" && (
              <div className="space-y-1.5">
                <Label>Pick a family</Label>
                <Select
                  value={joinFamilyId}
                  onValueChange={(v) => v && setJoinFamilyId(v)}
                >
                  <SelectTrigger className="bg-black border-[#222] text-white">
                    <SelectValue placeholder="Pick a family..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white max-h-72">
                    {families.map((f) => (
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
            )}

            {mode === "create" && (
              <div className="space-y-1.5">
                <Label htmlFor="new-family-name">Family / parent name</Label>
                <Input
                  id="new-family-name"
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  placeholder="The Smith Family"
                  className={inputCls}
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
                className="text-[#aaa] hover:text-white hover:bg-[#111]"
              >
                Cancel
              </Button>
              <Button
                onClick={onConvert}
                disabled={pending}
                className="bg-white text-black hover:bg-white/90"
              >
                {pending ? "Converting..." : "Convert"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ModeChip({
  active,
  onClick,
  disabled,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "inline-flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed " +
        (active
          ? "bg-white text-black"
          : "text-[#aaa] hover:bg-[#111] hover:text-white")
      }
    >
      {icon}
      {label}
    </button>
  );
}

export function LeadsTable({
  leads,
  families = [],
}: {
  leads: Lead[];
  families?: Family[];
}) {
  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No leads yet"
        description="Add a lead manually or connect your Webflow form to start filling your pipeline."
        className="my-2"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow className="border-[#1f1f1f] hover:bg-transparent">
          <TableHead className="text-[#888] uppercase text-xs tracking-wider">Name</TableHead>
          <TableHead className="text-[#888] uppercase text-xs tracking-wider">Phone</TableHead>
          <TableHead className="text-[#888] uppercase text-xs tracking-wider">Email</TableHead>
          <TableHead className="text-[#888] uppercase text-xs tracking-wider">Source</TableHead>
          <TableHead className="text-[#888] uppercase text-xs tracking-wider">Status</TableHead>
          <TableHead className="text-[#888] uppercase text-xs tracking-wider">Created</TableHead>
          <TableHead className="text-right text-[#888] uppercase text-xs tracking-wider">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => (
          <TableRow key={lead.id} className="border-[#1f1f1f] hover:bg-[#0a0a0a]">
            <TableCell className="font-medium text-white">{lead.name}</TableCell>
            <TableCell className="text-[#ccc]">{lead.phone ?? "—"}</TableCell>
            <TableCell className="text-[#ccc]">{lead.email ?? "—"}</TableCell>
            <TableCell className="text-[#ccc]">{lead.source ?? "—"}</TableCell>
            <TableCell>
              <StatusSelect id={lead.id} status={lead.status} />
            </TableCell>
            <TableCell className="text-[#888]">{formatDate(lead.created_at)}</TableCell>
            <TableCell className="text-right">
              <ConvertButton lead={lead} families={families} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}
