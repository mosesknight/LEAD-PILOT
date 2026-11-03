"use client";

import * as React from "react";
import { Download, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CSV_TEMPLATE } from "@/lib/constants";
import { parseCsv, rowsToLeads } from "@/lib/csv";
import { createManyLeads } from "@/lib/data";
import { notifyLeadsChanged } from "@/lib/events";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Lead, LeadInput } from "@/lib/types";

export function ImportLeadsDialog({
  open,
  onOpenChange,
  onImported,
  todayCount,
  quota,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (leads: Lead[]) => void;
  todayCount: number;
  quota: number;
}) {
  const { user } = useAuth();
  const [csv, setCsv] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const remaining = Math.max(0, quota - todayCount);
  const parsed = React.useMemo<LeadInput[]>(() => {
    if (!csv.trim()) return [];
    try {
      return rowsToLeads(parseCsv(csv));
    } catch {
      return [];
    }
  }, [csv]);

  const blocked = parsed.length > remaining;

  function handleOpenChange(next: boolean) {
    if (!next) setCsv("");
    onOpenChange(next);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    event.target.value = "";
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "leadpilot-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!parsed.length) {
      toast.error("Paste a CSV or choose a file first.");
      return;
    }
    if (blocked) {
      toast.error(`Only ${remaining} lead slots left today. Trim the file and try again.`);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) {
      toast.error("You need to be signed in.");
      return;
    }

    setPending(true);
    try {
      const leads = await createManyLeads(supabase, user.id, parsed);

      await supabase.from("activities").insert({
        user_id: user.id,
        lead_id: null,
        type: "lead_imported",
        description: `Imported ${leads.length} lead${leads.length === 1 ? "" : "s"} from CSV`,
        metadata: { count: leads.length },
      });

      onImported(leads);
      notifyLeadsChanged();
      toast.success(`${leads.length} leads imported.`);
      handleOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import leads from CSV</DialogTitle>
          <DialogDescription>
            {remaining > 0
              ? `${remaining} slots left today. Include a header row, or use the order: business_name, niche, website, email, phone, location, notes, high_ticket.`
              : "Today's quota is full. You can still prep tomorrow's file."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={handleFile}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp />
              Choose CSV
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
              <Download />
              Download template
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant={blocked ? "danger" : parsed.length ? "success" : "secondary"}>
                {parsed.length} valid row{parsed.length === 1 ? "" : "s"}
              </Badge>
              {blocked ? <Badge variant="warning">Over quota by {parsed.length - remaining}</Badge> : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="csv">Paste CSV</Label>
            <Textarea
              id="csv"
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              placeholder={"business_name,niche,website,email,phone,location,notes,high_ticket\nBright Smile Dental,Dental Clinic,https://brightsmile.com,hello@brightsmile.com,+15551234567,Austin TX,No booking form,true"}
              rows={8}
              className="font-mono text-[11px] leading-relaxed"
            />
          </div>

          {parsed.length ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[1.4fr_1fr_1.2fr_0.6fr] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Business</span>
                <span>Niche</span>
                <span>Contact</span>
                <span>Hot</span>
              </div>
              <div className="max-h-44 divide-y divide-border/60 overflow-y-auto">
                {parsed.slice(0, 8).map((lead, index) => (
                  <div
                    key={`${lead.business_name}-${index}`}
                    className="grid grid-cols-[1.4fr_1fr_1.2fr_0.6fr] items-center gap-2 px-3 py-2 text-[11px]"
                  >
                    <span className="truncate font-medium">{lead.business_name}</span>
                    <span className="truncate text-muted-foreground">{lead.niche || "—"}</span>
                    <span className="truncate text-muted-foreground">
                      {lead.email || lead.phone || "—"}
                    </span>
                    <span>{lead.high_ticket ? <Badge variant="hot">Hot</Badge> : "—"}</span>
                  </div>
                ))}
              </div>
              {parsed.length > 8 ? (
                <p className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                  + {parsed.length - 8} more rows
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={pending || !parsed.length || blocked || remaining === 0}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Upload />}
            Import {parsed.length || ""} lead{parsed.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
