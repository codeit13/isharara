import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, Trash2, Crown, ShieldCheck, UserCog, Loader2,
  Search, Copy, Check, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User, TenantMember } from "@shared/schema";

type MemberWithUser = TenantMember & { user: Omit<User, "passwordHash"> };
type SearchUser = { id: string; email: string | null; phone: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null };

const ROLE_ICON: Record<string, typeof Crown> = { owner: Crown, admin: ShieldCheck, staff: UserCog };
const ROLE_COLOR: Record<string, string> = {
  owner: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  staff: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

function UserSearchCombobox({ onSelect }: { onSelect: (user: SearchUser) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: results = [], isFetching } = useQuery<SearchUser[]>({
    queryKey: ["/api/super-admin/users/search", query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await fetch(`/api/super-admin/users/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: query.length >= 2,
    staleTime: 30_000,
  });

  const handleSearch = (value: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(value), 300);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs font-normal text-muted-foreground">
          <Search className="h-3.5 w-3.5" /> Search user by email or name…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type email, name, or phone…" onValueChange={handleSearch} />
          <CommandList>
            {isFetching && <div className="px-3 py-4 text-xs text-muted-foreground text-center">Searching…</div>}
            {!isFetching && query.length >= 2 && results.length === 0 && <CommandEmpty>No users found</CommandEmpty>}
            {results.length > 0 && (
              <CommandGroup>
                {results.map((u) => (
                  <CommandItem key={u.id} value={u.id} onSelect={() => { onSelect(u); setOpen(false); setQuery(""); }} className="gap-2.5">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={u.profileImageUrl ?? undefined} />
                      <AvatarFallback className="text-[9px]">{(u.firstName?.[0] ?? u.email?.[0] ?? "?").toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{u.email ?? u.phone}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost" size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied!" : "Copy user ID"}</TooltipContent>
    </Tooltip>
  );
}

export default function MembersSection({ tenantId }: { tenantId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [newRole, setNewRole] = useState<string>("admin");

  const { data: members = [], isLoading } = useQuery<MemberWithUser[]>({
    queryKey: ["/api/super-admin/tenants", tenantId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) return;
      await apiRequest("POST", `/api/super-admin/tenants/${tenantId}/members`, { userId: selectedUser.id, role: newRole });
    },
    onSuccess: () => {
      toast({ title: "Member added", description: `${selectedUser?.email ?? "User"} was added as ${newRole}.` });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenantId, "members"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      setSelectedUser(null);
    },
    onError: (err: Error) => toast({ title: "Failed to add member", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => { await apiRequest("DELETE", `/api/super-admin/tenants/${tenantId}/members/${userId}`); },
    onSuccess: () => {
      toast({ title: "Member removed" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenantId, "members"] });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
    },
    onError: (err: Error) => toast({ title: "Failed to remove", description: err.message, variant: "destructive" }),
  });

  const roleChangeMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await apiRequest("PATCH", `/api/super-admin/tenants/${tenantId}/members/${userId}/role`, { role });
    },
    onSuccess: () => {
      toast({ title: "Role updated" });
      qc.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenantId, "members"] });
    },
    onError: (err: Error) => toast({ title: "Failed to update role", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold">Members</h3>
        <p className="text-sm text-muted-foreground">Manage who has access to this tenant's admin panel.</p>
      </div>

      <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Add Member</p>
        <UserSearchCombobox onSelect={setSelectedUser} />
        {selectedUser && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-background border">
            <Avatar className="h-7 w-7">
              <AvatarImage src={selectedUser.profileImageUrl ?? undefined} />
              <AvatarFallback className="text-[10px]">{(selectedUser.firstName?.[0] ?? "?").toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{[selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(" ")}</p>
              <p className="text-[10px] text-muted-foreground truncate">{selectedUser.email ?? selectedUser.phone}</p>
            </div>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-8">Loading members…</div>
      ) : members.length === 0 ? (
        <div className="text-center py-10">
          <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No members yet</p>
          <p className="text-xs text-muted-foreground/70">Search and add users above</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead className="w-[50px]" /></TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={m.user.profileImageUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">{(m.user.firstName?.[0] ?? m.user.email?.[0] ?? "?").toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium truncate">{[m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || "—"}</p>
                        <CopyButton text={m.userId} />
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{m.user.email ?? m.user.phone ?? m.userId}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Select value={m.role} onValueChange={(role) => roleChangeMutation.mutate({ userId: m.userId, role })}>
                    <SelectTrigger className="h-7 w-[100px] text-[11px] border-0 bg-transparent hover:bg-muted px-2">
                      <div className="flex items-center gap-1">
                        {(() => { const I = ROLE_ICON[m.role] ?? UserCog; return <I className="h-3 w-3" />; })()}
                        <span className={ROLE_COLOR[m.role]}>{m.role}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner"><div className="flex items-center gap-1.5"><Crown className="h-3 w-3" /> Owner</div></SelectItem>
                      <SelectItem value="admin"><div className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Admin</div></SelectItem>
                      <SelectItem value="staff"><div className="flex items-center gap-1.5"><UserCog className="h-3 w-3" /> Staff</div></SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </AlertDialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Remove member</TooltipContent>
                    </Tooltip>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove member?</AlertDialogTitle>
                        <AlertDialogDescription>This will revoke <strong>{m.user.email ?? m.userId}</strong>'s access to this tenant.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeMutation.mutate(m.userId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
