"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  ADULT_BELTS,
  BELT_LABEL,
  STUDENT_STATUSES,
  STUDENT_STATUS_LABEL,
} from "@/lib/students";
import { createStudent } from "@/app/(dashboard)/students/actions";
import type { BeltRank, StudentStatus } from "@/lib/supabase/types";

const inputCls =
  "bg-black border-[#222] focus-visible:ring-white/40 text-white placeholder:text-[#666]";

export function NewStudentDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [belt, setBelt] = useState<BeltRank>("white");
  const [status, setStatus] = useState<StudentStatus>("active");
  const router = useRouter();

  function reset() {
    setBelt("white");
    setStatus("active");
    setError(null);
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createStudent({
        full_name: String(formData.get("full_name") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        date_of_birth: String(formData.get("date_of_birth") ?? "") || null,
        notes: String(formData.get("notes") ?? ""),
        belt_rank: belt,
        status,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-white text-black hover:bg-white/90"
      >
        <Plus className="h-4 w-4" />
        Add New Student
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription className="text-[#aaa]">
              Create a new student record. You can manage belt progression after.
            </DialogDescription>
          </DialogHeader>

          <form action={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                name="full_name"
                required
                placeholder="Full name"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="(555) 555-5555"
                  className={inputCls}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@email.com"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of birth</Label>
                <Input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
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

            <div className="space-y-2">
              <Label>Belt</Label>
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
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Goals, injuries, anything worth remembering"
                className={inputCls}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="text-[#aaa] hover:text-white hover:bg-[#111]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending}
                className="bg-white text-black hover:bg-white/90"
              >
                {pending ? "Saving..." : "Add Student"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
