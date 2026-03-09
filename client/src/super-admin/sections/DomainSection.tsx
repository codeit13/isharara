import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Globe, Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Copy, Server, Check,
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
  recordType?: "A" | "CNAME";
  instructions: {
    recordType?: "A" | "CNAME";
    record?: { type: string; host: string; value: string; ttl: number };
    cname: { type: string; host: string; value: string; ttl: number };
    note?: string;
  };
};

function isApexDomain(domain: string): boolean {
  return domain.split(".").filter(Boolean).length <= 2;
}

const STATUS_ICON = {
  pass: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  fail: <XCircle className="h-4 w-4 text-red-500" />,
};

function DnsRecordRow({
  type,
  host,
  value,
  ttl,
  valueLabel = "Value",
}: { type: string; host: string; value: string; ttl: number; valueLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const copyRow = () => {
    const text = [type, host.replace(/ \(or leave blank for root\)/, ""), value, String(ttl)].join("\t");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const gridCols = "grid-cols-[70px_1fr_1fr_60px_36px]";
  return (
    <div className="rounded-md border bg-muted/30 overflow-hidden overflow-x-auto">
      <div className={`grid ${gridCols} gap-2 items-center px-3 py-2 font-mono text-xs min-w-[320px]`}>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Type</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Host</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{valueLabel}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">TTL</span>
        <span />
      </div>
      <div className={`grid ${gridCols} gap-2 items-center px-3 py-2 bg-background/50 border-t min-w-[320px]`}>
        <span className="text-xs select-all font-medium shrink-0">{type}</span>
        <span className="text-xs select-all min-w-0">{host}</span>
        <span className="text-xs select-all min-w-0">{value}</span>
        <span className="text-xs select-all shrink-0">{ttl}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyRow}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? "Copied!" : "Copy row"}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

type DomainInfo = {
  serverHost: string;
  serverIp: string | null;
  recordType: "A" | "CNAME";
  record: { type: string; host: string; value: string; ttl: number };
};

export default function DomainSection({ tenant }: { tenant: EnrichedTenant }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [domainInfo, setDomainInfo] = useState<DomainInfo | null>(null);

  useEffect(() => {
    if (!tenant.domain) return;
    (async () => {
      try {
        const res = await apiRequest("GET", `/api/super-admin/tenants/${tenant.id}/domain-info`);
        setDomainInfo(await res.json());
      } catch {}
    })();
  }, [tenant.id, tenant.domain]);

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

  const serverHost = result?.serverHost ?? domainInfo?.serverHost ?? (typeof window !== "undefined" ? window.location.hostname : "your-server.com");
  const recordType = result?.recordType ?? domainInfo?.recordType ?? (tenant.domain && isApexDomain(tenant.domain) ? "A" : "CNAME");
  const record = result?.instructions?.record ?? domainInfo?.record ?? (recordType === "A"
    ? { type: "A", host: "@", value: domainInfo?.serverIp ?? serverHost, ttl: 3600 }
    : { type: "CNAME", host: tenant.domain!, value: serverHost, ttl: 3600 });

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
        <p className="text-xs text-muted-foreground">
          {recordType === "A"
            ? "Root/apex domains (e.g. example.com) must use an A record. Add the following with your registrar:"
            : "Subdomains (e.g. shop.example.com) should use a CNAME record. Add the following with your registrar:"}
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">{recordType === "A" ? "Required for apex" : "Recommended"}</Badge>
            {recordType} Record
          </div>
          <DnsRecordRow
            type={record.type}
            host={record.host === "@" ? "@" : record.host}
            value={record.value}
            ttl={record.ttl}
            valueLabel={recordType === "A" ? "Value (IP)" : "Value"}
          />
        </div>

        <Separator />

        <div className="text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Step-by-step:</p>
          <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed">
            <li>Log in to your domain registrar (e.g., GoDaddy, Namecheap, Cloudflare)</li>
            <li>Navigate to <strong>DNS Management</strong> for <code className="bg-muted px-1 rounded">{tenant.domain!.split(".").slice(-2).join(".")}</code></li>
            {recordType === "A" ? (
              <>
                <li>Add a new <strong>A</strong> record:
                  <div className="mt-1 ml-4 space-y-0.5">
                    <p>Host/Name: <code className="bg-muted px-1 rounded">@</code> (or leave blank for root domain)</p>
                    <p>Value: <code className="bg-muted px-1 rounded">{record.value}</code> (your server&apos;s IP address)</p>
                  </div>
                </li>
              </>
            ) : (
              <li>Add a new <strong>CNAME</strong> record:
                <div className="mt-1 ml-4 space-y-0.5">
                  <p>Host/Name: <code className="bg-muted px-1 rounded">{tenant.domain!.split(".")[0]}</code></p>
                  <p>Points to: <code className="bg-muted px-1 rounded">{serverHost}</code></p>
                </div>
              </li>
            )}
            <li>Set TTL to <strong>3600</strong> (1 hour) or &quot;Auto&quot;</li>
            <li>Save and wait for DNS propagation (usually 5 min – 48 hours)</li>
            <li>Click <strong>&quot;Verify Domain&quot;</strong> below to check</li>
          </ol>
        </div>

        <Separator />

        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-medium">Important Notes:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>If using Cloudflare, set the proxy status to <strong>&quot;DNS Only&quot;</strong> (grey cloud) initially</li>
            <li><strong>Root/apex domains</strong> (e.g. example.com) must use an <strong>A record</strong> pointing to your server IP</li>
            <li><strong>Subdomains</strong> (e.g. shop.example.com) should use a <strong>CNAME record</strong> pointing to <code className="bg-muted/80 px-0.5 rounded">{serverHost}</code></li>
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
