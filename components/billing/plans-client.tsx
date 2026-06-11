"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  INTERVALS,
  INTERVAL_LABEL,
  INTERVAL_SHORT,
  formatMoney,
} from "@/lib/billing";
import {
  createPlan,
  deletePlan,
  updatePlan,
} from "@/app/(dashboard)/billing/actions";
import type {
  Database,
  MembershipInterval,
} from "@/lib/supabase/types";

type Plan = Database["public"]["Tables"]["membership_plans"]["Row"];

const inputCls =
  "bg-black border-[#222] focus-visible:ring-white/40 text-white placeholder:text-[#666]";

export function PlansClient({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // form state
  const [name, setName] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [interval, setInterval] = useState<MembershipInterval>("month");
  const [description, setDescription] = useState("");

  function openCreate() {
    setEditing(null);
    setName("");
    setPriceDollars("");
    setInterval("month");
    setDescription("");
    setError(null);
    setOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditing(plan);
    setName(plan.name);
    setPriceDollars((plan.price_cents / 100).toFixed(2));
    setInterval(plan.interval);
    setDescription(plan.description ?? "");
    setError(null);
    setOpen(true);
  }

  function onSubmit() {
    setError(null);
    const cents = Math.round(parseFloat(priceDollars || "0") * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      setError("Enter a valid price.");
      return;
    }
    const input = {
      name,
      price_cents: cents,
      interval,
      description,
    };
    startTransition(async () => {
      const result = editing
        ? await updatePlan(editing.id, input)
        : await createPlan(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function onDelete(plan: Plan) {
    if (!confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deletePlan(plan.id);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Membership Plans
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {plans.length} plan{plans.length === 1 ? "" : "s"} · Define the
            packages you sell.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-white text-black hover:bg-white/90"
        >
          <Plus className="h-4 w-4" />
          New Plan
        </Button>
      </div>

      <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
        <CardContent className="p-0">
          {plans.length === 0 ? (
            <div className="text-center py-16 text-sm text-[#888]">
              No plans yet. Click <span className="text-white">New Plan</span>{" "}
              to create your first one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#1f1f1f] hover:bg-transparent">
                  <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                    Name
                  </TableHead>
                  <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                    Price
                  </TableHead>
                  <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                    Interval
                  </TableHead>
                  <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                    Stripe
                  </TableHead>
                  <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                    Description
                  </TableHead>
                  <TableHead className="text-right text-[#888] uppercase text-xs tracking-wider">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow
                    key={plan.id}
                    className="border-[#1f1f1f] hover:bg-[#0a0a0a]"
                  >
                    <TableCell className="font-medium text-white">
                      {plan.name}
                    </TableCell>
                    <TableCell className="text-white tabular-nums">
                      {formatMoney(plan.price_cents)}
                      <span className="text-[#666] ml-1">
                        {INTERVAL_SHORT[plan.interval]}
                      </span>
                    </TableCell>
                    <TableCell className="text-[#ccc]">
                      {INTERVAL_LABEL[plan.interval]}
                    </TableCell>
                    <TableCell>
                      {plan.stripe_price_id ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2.5 py-0.5 text-xs">
                          Synced
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-[#333] bg-[#111] text-[#888] px-2.5 py-0.5 text-xs">
                          Pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-[#aaa] max-w-[280px] truncate">
                      {plan.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEdit(plan)}
                          className="h-8 w-8 grid place-items-center rounded-md border border-[#222] text-[#aaa] hover:bg-[#111] hover:text-white transition-colors"
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(plan)}
                          className="h-8 w-8 grid place-items-center rounded-md border border-[#222] text-[#aaa] hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40 transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Plan" : "New Membership Plan"}
            </DialogTitle>
            <DialogDescription className="text-[#aaa]">
              {editing
                ? "Updating price or interval will re-sync to Stripe on next subscribe."
                : "Stripe Product + Price are created automatically when the first student subscribes."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Unlimited Adult"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-price">Price (USD)</Label>
                <Input
                  id="p-price"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={priceDollars}
                  onChange={(e) => setPriceDollars(e.target.value)}
                  placeholder="199.00"
                  className={inputCls}
                />
              </div>
              <div className="space-y-2">
                <Label>Interval</Label>
                <Select
                  value={interval}
                  onValueChange={(v) => v && setInterval(v as MembershipInterval)}
                >
                  <SelectTrigger className="bg-black border-[#222] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white">
                    {INTERVALS.map((i) => (
                      <SelectItem
                        key={i}
                        value={i}
                        className="focus:bg-[#111] focus:text-white"
                      >
                        {INTERVAL_LABEL[i]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea
                id="p-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Unlimited classes, 24/7 mat access, gi included..."
                className={inputCls}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-[#aaa] hover:text-white hover:bg-[#111]"
            >
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={pending}
              className="bg-white text-black hover:bg-white/90"
            >
              {pending ? "Saving..." : editing ? "Save Changes" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
