"use client";

import { Search, ShieldCheck, ShieldAlert, Users, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent } from "@/components/ui/card";
import { BeltBadge } from "@/components/students/belt-badge";
import { NewStudentDialog } from "@/components/students/new-student-dialog";
import { StudentDetailDialog } from "@/components/students/student-detail-dialog";
import {
  STUDENT_STATUS_BADGE,
  STUDENT_STATUS_LABEL,
  formatDate,
} from "@/lib/students";
import { cn } from "@/lib/utils";
import type { Database, StudentStatus } from "@/lib/supabase/types";

type Student = Database["public"]["Tables"]["students"]["Row"];
type BeltProgress = Database["public"]["Tables"]["belt_progress"]["Row"];
type Membership = Database["public"]["Tables"]["memberships"]["Row"];
type Plan = Database["public"]["Tables"]["membership_plans"]["Row"];
type Family = Database["public"]["Tables"]["family_accounts"]["Row"];
type Waiver = Database["public"]["Tables"]["waivers"]["Row"];

type Filter = "all" | StudentStatus | "inactive";
type FamilyFilter = "all" | "family" | "individual";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "trial", label: "Trial" },
  { value: "inactive", label: "Inactive" },
];

const FAMILY_FILTERS: { value: FamilyFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "family", label: "Family" },
  { value: "individual", label: "Individual" },
];

export function StudentsPageClient({
  students,
  progressByStudent,
  membershipByStudent = {},
  plans = [],
  stripeConfigured = false,
  families = [],
  waiversByStudent = {},
}: {
  students: Student[];
  progressByStudent: Record<string, BeltProgress>;
  membershipByStudent?: Record<string, Membership>;
  plans?: Plan[];
  stripeConfigured?: boolean;
  families?: Family[];
  waiversByStudent?: Record<string, Waiver[]>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const familyById = useMemo(
    () => new Map(families.map((f) => [f.id, f] as const)),
    [families],
  );

  const studentsByFamily = useMemo(() => {
    const map: Record<string, { id: string; full_name: string }[]> = {};
    for (const s of students) {
      if (!s.family_account_id) continue;
      (map[s.family_account_id] ??= []).push({
        id: s.id,
        full_name: s.full_name,
      });
    }
    return map;
  }, [students]);

  const unassignedStudents = useMemo(
    () =>
      students
        .filter((s) => !s.family_account_id)
        .map((s) => ({ id: s.id, full_name: s.full_name })),
    [students],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (filter === "inactive") {
        if (s.status !== "paused" && s.status !== "cancelled") return false;
      } else if (filter !== "all" && s.status !== filter) {
        return false;
      }
      if (familyFilter === "family" && !s.family_account_id) return false;
      if (familyFilter === "individual" && s.family_account_id) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [students, query, filter, familyFilter]);

  const selectedStudent = selectedId
    ? (students.find((s) => s.id === selectedId) ?? null)
    : null;
  const selectedProgress = selectedId
    ? (progressByStudent[selectedId] ?? null)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Students
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {students.length} total · {filtered.length} shown
          </p>
        </div>
        <NewStudentDialog />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="pl-9 bg-[#0a0a0a] border-[#222] text-white placeholder:text-[#666] focus-visible:ring-white/40"
          />
        </div>
        <Select value={filter} onValueChange={(v) => v && setFilter(v as Filter)}>
          <SelectTrigger className="bg-[#0a0a0a] border-[#222] text-white w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white">
            {FILTERS.map((f) => (
              <SelectItem
                key={f.value}
                value={f.value}
                className="focus:bg-[#111] focus:text-white"
              >
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={familyFilter}
          onValueChange={(v) => v && setFamilyFilter(v as FamilyFilter)}
        >
          <SelectTrigger className="bg-[#0a0a0a] border-[#222] text-white w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white">
            {FAMILY_FILTERS.map((f) => (
              <SelectItem
                key={f.value}
                value={f.value}
                className="focus:bg-[#111] focus:text-white"
              >
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            students.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={UserPlus}
                  title="No students yet"
                  description="Add your first student or convert a lead. You can also import a full roster from Settings → Import."
                  action={<NewStudentDialog />}
                />
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-[#666]">
                No students match your search or filters.
              </div>
            )
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#1f1f1f] hover:bg-transparent">
                  <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                    Name
                  </TableHead>
                  <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                    Phone
                  </TableHead>
                  <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                    Email
                  </TableHead>
                  <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                    Belt
                  </TableHead>
                  <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                    Join Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const prog = progressByStudent[s.id];
                  const belt = prog?.current_belt ?? s.belt_rank;
                  const stripes = prog?.stripes ?? 0;
                  return (
                    <TableRow
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className="border-[#1f1f1f] hover:bg-[#0a0a0a] cursor-pointer"
                    >
                      <TableCell className="font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span>{s.full_name}</span>
                          {s.family_account_id && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#aaa] border border-[#222] rounded-full px-1.5 py-0.5"
                              title={
                                familyById.get(s.family_account_id)?.parent_name ??
                                "Family"
                              }
                            >
                              <Users className="h-3 w-3" />
                              Family
                            </span>
                          )}
                          {(waiversByStudent[s.id]?.length ?? 0) > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-300 border border-emerald-500/40 bg-emerald-500/10 rounded-full px-1.5 py-0.5"
                              title="Waiver on file"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              Waiver
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-amber-200 border border-amber-500/40 bg-amber-500/10 rounded-full px-1.5 py-0.5"
                              title="No waiver on file"
                            >
                              <ShieldAlert className="h-3 w-3" />
                              Unsigned
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-[#ccc]">
                        {s.phone ?? "—"}
                      </TableCell>
                      <TableCell className="text-[#ccc]">
                        {s.email ?? "—"}
                      </TableCell>
                      <TableCell>
                        <BeltBadge belt={belt} stripes={stripes} />
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            STUDENT_STATUS_BADGE[s.status],
                          )}
                        >
                          {STUDENT_STATUS_LABEL[s.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-[#888]">
                        {formatDate(s.join_date)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <StudentDetailDialog
        student={selectedStudent}
        progress={selectedProgress}
        membership={selectedId ? (membershipByStudent[selectedId] ?? null) : null}
        plans={plans}
        stripeConfigured={stripeConfigured}
        family={
          selectedStudent?.family_account_id
            ? (familyById.get(selectedStudent.family_account_id) ?? null)
            : null
        }
        familyMembers={
          selectedStudent?.family_account_id
            ? (studentsByFamily[selectedStudent.family_account_id] ?? [])
            : []
        }
        allFamilies={families}
        unassignedStudents={unassignedStudents}
        waivers={selectedId ? (waiversByStudent[selectedId] ?? []) : []}
        open={selectedId !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null);
        }}
      />
    </div>
  );
}
