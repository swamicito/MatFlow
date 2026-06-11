"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Download,
  FileSignature,
  FileText,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { waiverTypeLabel, formatDate } from "@/lib/students";
import {
  createWaiverTemplate,
  deleteWaiverTemplate,
  uploadTemplatePdf,
  type WaiverTemplateRow,
  type SignedWaiverRow,
} from "@/app/(dashboard)/settings/waivers/actions";

const inputCls =
  "bg-black border-[#222] focus-visible:ring-white/40 text-white placeholder:text-[#666]";

export function WaiversAdmin({
  templates,
  signedWaivers,
}: {
  templates: WaiverTemplateRow[];
  signedWaivers: SignedWaiverRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const [newPdf, setNewPdf] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalSigned = signedWaivers.length;
  const studentsWithWaiver = new Set(signedWaivers.map((w) => w.student_id)).size;
  const requiredTemplates = templates.filter((t) => t.required).length;

  function openNew() {
    setNewName("");
    setNewRequired(false);
    setNewPdf(null);
    setError(null);
    setShowNew(true);
  }

  function onSubmit() {
    setError(null);
    if (!newName.trim()) {
      setError("Template name is required.");
      return;
    }
    startTransition(async () => {
      const result = await createWaiverTemplate({
        name: newName.trim(),
        required: newRequired,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (newPdf) {
        const fd = new FormData();
        fd.append("pdf", newPdf);
        const uploadResult = await uploadTemplatePdf(result.data.id, fd);
        if (!uploadResult.ok) {
          setError(`Template created but PDF upload failed: ${uploadResult.error}`);
          setShowNew(false);
          router.refresh();
          return;
        }
      }
      setShowNew(false);
      router.refresh();
    });
  }

  function onDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteWaiverTemplate(id);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
          Digital Waivers
        </h1>
        <p className="text-sm text-[#aaa] mt-1">
          Manage waiver templates and view all signed waivers across your gym.
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Templates", value: templates.length },
          { label: "Required", value: requiredTemplates },
          { label: "Total Signed", value: totalSigned },
          { label: "Students w/ Waiver", value: studentsWithWaiver },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-4 text-center"
          >
            <p className="text-2xl font-semibold tabular-nums text-white">
              {stat.value}
            </p>
            <p className="text-xs text-[#888] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Templates section ── */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">Waiver Templates</h2>
            <p className="text-sm text-[#888] mt-0.5">
              Define the waiver types your gym uses. Mark required ones so staff
              knows every student must sign them before training.
            </p>
          </div>
          <Button
            onClick={openNew}
            className="bg-white text-black hover:bg-white/90 shrink-0"
          >
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#222] p-10 text-center space-y-3">
            <FileSignature className="h-8 w-8 text-[#444] mx-auto" />
            <div>
              <p className="text-sm text-white">No templates yet</p>
              <p className="text-xs text-[#666] mt-0.5">
                Create your first template to start tracking compliance.
              </p>
            </div>
            <Button
              onClick={openNew}
              variant="outline"
              size="sm"
              className="border-[#333] bg-transparent hover:bg-[#111] text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Template
            </Button>
          </div>
        ) : (
          <ul className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] divide-y divide-[#1a1a1a]">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-[#555] shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-medium">
                        {t.name}
                      </span>
                      {t.required && (
                        <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                          Required
                        </span>
                      )}
                      {t.pdf_template_url && (
                        <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/5 text-blue-400 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                          PDF attached
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#666] mt-0.5">
                      {t.signed_count} signed · Created {formatDate(t.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {t.pdf_template_url && (
                    <a
                      href={t.pdf_template_url}
                      target="_blank"
                      rel="noreferrer"
                      className="h-8 w-8 grid place-items-center rounded-md border border-[#222] text-[#aaa] hover:bg-[#111] hover:text-white transition-colors"
                      title="View template PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => onDelete(t.id, t.name)}
                    disabled={pending}
                    className="h-8 w-8 grid place-items-center rounded-md border border-[#222] text-[#aaa] hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40 transition-colors disabled:opacity-40"
                    title="Delete template"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Signed Waivers section ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">All Signed Waivers</h2>
          <p className="text-sm text-[#888] mt-0.5">
            Every waiver signed by students at your gym, across all waiver types.
            {totalSigned >= 500 && (
              <span className="text-[#666]"> Showing the latest 500.</span>
            )}
          </p>
        </div>

        {signedWaivers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#222] p-10 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-[#444] mx-auto" />
            <p className="text-sm text-white">No signed waivers on file yet</p>
            <p className="text-xs text-[#666]">
              Waivers are signed from each student&apos;s detail panel in the
              Students section.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1f1f1f]">
                    <th className="text-left px-4 py-2.5 text-[#666] text-xs uppercase tracking-wider font-medium whitespace-nowrap">
                      Student
                    </th>
                    <th className="text-left px-4 py-2.5 text-[#666] text-xs uppercase tracking-wider font-medium whitespace-nowrap">
                      Waiver Type
                    </th>
                    <th className="text-left px-4 py-2.5 text-[#666] text-xs uppercase tracking-wider font-medium whitespace-nowrap">
                      Signed
                    </th>
                    <th className="text-left px-4 py-2.5 text-[#666] text-xs uppercase tracking-wider font-medium whitespace-nowrap">
                      Signed By
                    </th>
                    <th className="px-4 py-2.5 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {signedWaivers.map((w) => (
                    <tr
                      key={w.id}
                      className="hover:bg-[#0d0d0d] transition-colors"
                    >
                      <td className="px-4 py-3 text-white whitespace-nowrap">
                        {w.student_name}
                      </td>
                      <td className="px-4 py-3 text-[#ccc] whitespace-nowrap">
                        {waiverTypeLabel(w.waiver_type)}
                      </td>
                      <td className="px-4 py-3 text-[#888] whitespace-nowrap">
                        {formatDate(w.signed_at)}
                      </td>
                      <td className="px-4 py-3 text-[#888]">
                        {w.signed_by_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {w.pdf_url ? (
                          <a
                            href={w.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            download
                            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </a>
                        ) : (
                          <span className="text-xs text-[#555]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── New Template Dialog ── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Waiver Template</DialogTitle>
            <DialogDescription className="text-[#aaa]">
              Define a waiver type for your gym. Optionally attach a PDF
              template for reference.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="tmpl-name">Template name</Label>
              <Input
                id="tmpl-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Liability Release"
                className={inputCls}
                onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="h-4 w-4 mt-0.5 accent-white"
              />
              <div>
                <p className="text-sm text-white">Mark as required</p>
                <p className="text-xs text-[#666]">
                  Flags this waiver so staff knows every student must sign it
                  before training.
                </p>
              </div>
            </label>

            <div className="space-y-2">
              <Label>PDF template <span className="text-[#555]">(optional)</span></Label>
              <div
                className={cn(
                  "rounded-md border border-dashed border-[#333] p-4 text-center cursor-pointer hover:border-[#444] transition-colors",
                  newPdf && "border-[#444] bg-[#111]",
                )}
                onClick={() => fileRef.current?.click()}
              >
                {newPdf ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-white">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="truncate max-w-[220px]">{newPdf.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewPdf(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      className="text-[#666] hover:text-white shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-5 w-5 text-[#555] mx-auto" />
                    <p className="text-sm text-[#666]">
                      Click to upload a PDF template
                    </p>
                    <p className="text-xs text-[#444]">Max 10 MB · PDF only</p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setNewPdf(e.target.files?.[0] ?? null)}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2 flex items-start gap-2">
                <X className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={() => setShowNew(false)}
                className="text-[#aaa] hover:text-white hover:bg-[#111]"
              >
                Cancel
              </Button>
              <Button
                onClick={onSubmit}
                disabled={pending || !newName.trim()}
                className="bg-white text-black hover:bg-white/90"
              >
                {pending ? "Saving…" : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
