import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, IndianRupee, CheckCircle2, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { TenantPayment } from "@shared/schema";
import type { EnrichedTenant } from "../components/TenantsTable";

const PAY_TYPE_LABEL: Record<string, string> = { setup: "Setup Fee", retainer: "Retainer", addon: "Add-on", refund: "Refund", custom: "Custom" };
const PAY_STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  waived: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export default function BillingSection({ tenant }: { tenant: EnrichedTenant }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [billingForm, setBillingForm] = useState({
    setupFee: tenant.setupFee ?? 0,
    retainerAmount: tenant.retainerAmount ?? 0,
    billingCycle: tenant.billingCycle ?? "",
    nextDueDate: tenant.nextDueDate ? new Date(tenant.nextDueDate).toISOString().split("T")[0] : "",
  });
  const [payForm, setPayForm] = useState({
    type: "retainer" as string, amount: 0, status: "paid" as string, dueDate: "", note: "",
  });

  useEffect(() => {
    setBillingForm({
      setupFee: tenant.setupFee ?? 0,
      retainerAmount: tenant.retainerAmount ?? 0,
      billingCycle: tenant.billingCycle ?? "",
      nextDueDate: tenant.nextDueDate ? new Date(tenant.nextDueDate).toISOString().split("T")[0] : "",
    });
  }, [tenant]);

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<TenantPayment[]>({
    queryKey: ["/api/super-admin/tenants", tenant.id, "payments"],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}/payments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const saveBillingMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/super-admin/tenants/${tenant.id}/billing`, {
        setupFee: billingForm.setupFee || null,
        retainerAmount: billingForm.retainerAmount || null,
        billingCycle: billingForm.billingCycle || null,
        nextDueDate: billingForm.nextDueDate || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Billing config saved" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/super-admin/tenants/${tenant.id}/payments`, {
        type: payForm.type, amount: payForm.amount, status: payForm.status,
        dueDate: payForm.dueDate || null, note: payForm.note || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Payment recorded" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenant.id, "payments"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/stats"] });
      setShowAddPayment(false);
      setPayForm({ type: "retainer", amount: 0, status: "paid", dueDate: "", note: "" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (paymentId: number) => { await apiRequest("PATCH", `/api/super-admin/payments/${paymentId}`, { status: "paid" }); },
    onSuccess: () => {
      toast({ title: "Marked as paid" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenant.id, "payments"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/stats"] });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: number) => { await apiRequest("DELETE", `/api/super-admin/payments/${paymentId}`); },
    onSuccess: () => {
      toast({ title: "Payment deleted" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenant.id, "payments"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/stats"] });
    },
  });

  const totalCollected = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter((p) => p.status === "pending" || p.status === "overdue").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-lg font-semibold">Billing</h3>
        <p className="text-sm text-muted-foreground">Configure platform billing and track payments from this tenant.</p>
      </div>

      {/* Config */}
      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-medium">Billing Configuration</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Setup Fee (₹)</Label>
            <Input type="number" value={billingForm.setupFee} onChange={(e) => setBillingForm((p) => ({ ...p, setupFee: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Retainer Amount (₹)</Label>
            <Input type="number" value={billingForm.retainerAmount} onChange={(e) => setBillingForm((p) => ({ ...p, retainerAmount: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Billing Cycle</Label>
            <Select value={billingForm.billingCycle} onValueChange={(v) => setBillingForm((p) => ({ ...p, billingCycle: v }))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select cycle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="one-time">One-time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Next Due Date</Label>
            <Input type="date" value={billingForm.nextDueDate} onChange={(e) => setBillingForm((p) => ({ ...p, nextDueDate: e.target.value }))} />
          </div>
        </div>
        <Button size="sm" onClick={() => saveBillingMutation.mutate()} disabled={saveBillingMutation.isPending} className="w-full">
          {saveBillingMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />} Save Billing Config
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">₹{totalCollected.toLocaleString("en-IN")}</p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Collected</p>
        </div>
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
          <p className="text-lg font-bold text-amber-700 dark:text-amber-400">₹{totalPending.toLocaleString("en-IN")}</p>
          <p className="text-[10px] text-amber-600 dark:text-amber-500 uppercase tracking-wider">Pending / Overdue</p>
        </div>
      </div>

      {/* Add payment */}
      {showAddPayment ? (
        <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground">Record Payment</p>
          <div className="grid grid-cols-2 gap-2">
            <Select value={payForm.type} onValueChange={(v) => setPayForm((p) => ({ ...p, type: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="setup">Setup Fee</SelectItem>
                <SelectItem value="retainer">Retainer</SelectItem>
                <SelectItem value="addon">Add-on</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Amount (₹)" value={payForm.amount || ""} onChange={(e) => setPayForm((p) => ({ ...p, amount: Number(e.target.value) }))} className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={payForm.status} onValueChange={(v) => setPayForm((p) => ({ ...p, status: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={payForm.dueDate} onChange={(e) => setPayForm((p) => ({ ...p, dueDate: e.target.value }))} className="h-8 text-xs" />
          </div>
          <Input placeholder="Note (optional)" value={payForm.note} onChange={(e) => setPayForm((p) => ({ ...p, note: e.target.value }))} className="h-8 text-xs" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowAddPayment(false)}>Cancel</Button>
            <Button size="sm" className="flex-1" onClick={() => addPaymentMutation.mutate()} disabled={!payForm.amount || addPaymentMutation.isPending}>
              {addPaymentMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Record"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAddPayment(true)}>+ Record Payment</Button>
      )}

      {/* History */}
      <div>
        <h4 className="text-sm font-medium mb-2">Payment History</h4>
        {paymentsLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
        ) : payments.length === 0 ? (
          <div className="text-center py-8">
            <IndianRupee className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No payments recorded yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">₹{p.amount.toLocaleString("en-IN")}</span>
                    <Badge variant="secondary" className={`text-[9px] px-1.5 ${PAY_STATUS_STYLE[p.status] ?? ""}`}>{p.status}</Badge>
                    <Badge variant="outline" className="text-[9px] px-1.5">{PAY_TYPE_LABEL[p.type] ?? p.type}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    {p.paidAt && <span>Paid {new Date(p.paidAt).toLocaleDateString("en-IN")}</span>}
                    {p.dueDate && !p.paidAt && <span>Due {new Date(p.dueDate).toLocaleDateString("en-IN")}</span>}
                    {p.note && <span className="truncate">• {p.note}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(p.status === "pending" || p.status === "overdue") && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => markPaidMutation.mutate(p.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Mark as paid</TooltipContent>
                    </Tooltip>
                  )}
                  <AlertDialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </AlertDialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete payment?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently remove this ₹{p.amount.toLocaleString("en-IN")} {p.type} payment record.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deletePaymentMutation.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
