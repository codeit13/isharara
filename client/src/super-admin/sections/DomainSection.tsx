import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Globe, Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  ClipboardCopy, Server, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { EnrichedTenant } from "../components/TenantsTable";

type DnsCheck = { type: string; status: "pass" | "fail" | "warn"; detail: string };
type VerifyResult = {
  verified: boolean; dnsReady: boolean; checks: DnsCheck[];
  serverHost: string;
  instructions: { cname: { type: string; host: string; value: string; ttl: number }; note?: string };
};

const STATUS_ICON = {
  pass: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  fail: <XCircle className="h-4 w-4 text-red-500" />,
};

function CopyableRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 font-mono text-xs">
      <span className="text-muted-foreground w-14 shrink-0 text-[10px] uppercase tracking-wider">{label}</span>
      <span className="flex-1 truncate select-all">{value}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <ClipboardCopy className="h-3 w-3" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied!" : "Copy"}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export default function DomainSection({ tenant }: { tenant: EnrichedTenant }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [checking, setChecking] = useState(false);

  const verify = async () => {
    setChecking(true);
    try {
      const res = await apiRequest("POST", `/api/super-admin/tenants/${tenant.id}/verify-domain`);
      const data: VerifyResult = await res.json();
      setResult(data);
      if (data.verified) {
        toast({ title: "Domain verified!", description: `${tenant.domain} is fully configured.` });
        qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      }
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  if (!tenant.domain) {
    return (
      <div className="max-w-xl space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Domain</h3>
          <p className="text-sm text-muted-foreground">Custom domain and DNS configuration.</p>
        </div>
        <div className="text-center py-10">
          <Globe className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No custom domain configured</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Set a domain in the General section first</p>
        </div>
      </div>
    );
  }

  const serverHost = result?.serverHost ?? (typeof window !== "undefined" ? window.location.hostname : "your-server.com");

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-lg font-semibold">Domain</h3>
        <p className="text-sm text-muted-foreground">Custom domain and DNS configuration.</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <code className="text-sm font-medium">{tenant.domain}</code>
          {tenant.domainVerified ? (
            <Badge className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[10px]">
              <CheckCircle2 className="h-3 w-3" /> Verified
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 text-[10px] text-amber-600">
              <AlertTriangle className="h-3 w-3" /> Unverified
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-1.5"><Server className="h-3.5 w-3.5" /> DNS Configuration</h4>
        <p className="text-xs text-muted-foreground">Add the following DNS record with your domain registrar:</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">Recommended</Badge> CNAME Record
          </div>
          <div className="space-y-1.5">
            <CopyableRow label="Type" value="CNAME" />
            <CopyableRow label="Host" value={tenant.domain!} />
            <CopyableRow label="Value" value={serverHost} />
            <CopyableRow label="TTL" value="3600" />
          </div>
        </div>

        <Separator />

        <div className="text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Step-by-step:</p>
          <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed">
            <li>Log in to your domain registrar (e.g., GoDaddy, Namecheap, Cloudflare)</li>
            <li>Navigate to <strong>DNS Management</strong> for <code className="bg-muted px-1 rounded">{tenant.domain!.split(".").slice(-2).join(".")}</code></li>
            <li>Add a new <strong>CNAME</strong> record:
              <div className="mt-1 ml-4 space-y-0.5">
                <p>Host/Name: <code className="bg-muted px-1 rounded">{tenant.domain!.split(".")[0]}</code></p>
                <p>Points to: <code className="bg-muted px-1 rounded">{serverHost}</code></p>
              </div>
            </li>
            <li>Set TTL to <strong>3600</strong> (1 hour) or "Auto"</li>
            <li>Save and wait for DNS propagation (usually 5 min – 48 hours)</li>
            <li>Click <strong>"Verify Domain"</strong> below to check</li>
          </ol>
        </div>

        <Separator />

        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-medium">Important Notes:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>If using Cloudflare, set the proxy status to <strong>"DNS Only"</strong> (grey cloud) initially</li>
            <li>For root domains (e.g., example.com), use an <strong>A record</strong> instead of CNAME</li>
            <li>SSL certificates are provisioned automatically after DNS verification</li>
            <li>DNS propagation may take up to 48 hours in some regions</li>
          </ul>
        </div>
      </div>

      <Button onClick={verify} disabled={checking} className="w-full gap-1.5">
        {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Verify Domain
      </Button>

      {result && (
        <div className="rounded-lg border p-4 space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            {result.verified ? <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> All Checks Passed</> :
              result.dnsReady ? <><AlertTriangle className="h-4 w-4 text-amber-500" /> DNS Ready — Awaiting HTTPS</> :
                <><XCircle className="h-4 w-4 text-red-500" /> Verification Failed</>}
          </h4>
          <div className="space-y-2">
            {result.checks.map((c, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2 rounded-md bg-muted/30">
                <div className="mt-0.5 shrink-0">{STATUS_ICON[c.status]}</div>
                <div className="min-w-0">
                  <p className="text-xs font-medium">{c.type} Record</p>
                  <p className="text-[11px] text-muted-foreground break-all">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
          {result.instructions.note && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-[11px] text-blue-800 dark:text-blue-300">
              {result.instructions.note}
            </div>
          )}
          {!result.verified && (
            <p className="text-[11px] text-muted-foreground text-center">DNS changes can take time to propagate. Try again in a few minutes.</p>
          )}
        </div>
      )}
    </div>
  );
}
