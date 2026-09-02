import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Check, Plus, X } from "lucide-react";
import {
  approveApplication,
  getFeeConfig,
  grantDriver,
  listApplications,
  listDrivers,
  masterReset,
  photoUrls,
  quickAddStudent,
  rejectApplication,
  revokeDriver,
} from "@/lib/bus.functions";

import { StudentDetailDialog } from "./StudentDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  DEFAULT_PENALTIES,
  currentPeriod,
  formatDate,
  formatINR,
  periodLabel,
} from "@/lib/fee-rules";

const todayISO = () => new Date().toISOString().slice(0, 10);

export function RegistrationTab() {
  const [joining, setJoining] = useState<Record<string, string>>({});
  const [fine, setFine] = useState<Record<string, string>>({});
  const [superfine, setSuperfine] = useState<Record<string, string>>({});
  const [advance, setAdvance] = useState<Record<string, string>>({});

  const fetchApps = useServerFn(listApplications);
  const approveFn = useServerFn(approveApplication);
  const rejectFn = useServerFn(rejectApplication);
  const quickAddFn = useServerFn(quickAddStudent);
  const photosFn = useServerFn(photoUrls);
  const feeCfgFn = useServerFn(getFeeConfig);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchApps(),
  });

  const period = currentPeriod();
  const { data: feeCfg } = useQuery({
    queryKey: ["fee-config", period],
    queryFn: () => feeCfgFn({ data: { period } }),
  });

  /** Defaults for a pending application: penalties and one month's fee as advance. */
  const defaultsFor = (stage: string) => {
    const higher = stage !== "Stage-1";
    const slabDefaults = DEFAULT_PENALTIES[higher ? "higher" : "lower"];
    const cfg = feeCfg?.config ?? null;
    const monthFee = cfg ? Number(higher ? cfg.higher_amount : cfg.lower_amount) : 0;
    return { ...slabDefaults, advance: monthFee };
  };

  const paths = (data?.students ?? [])
    .map((s) => s.photo_path)
    .filter((p): p is string => Boolean(p));

  const { data: photos } = useQuery({
    queryKey: ["application-photos", paths.join(",")],
    queryFn: () => photosFn({ data: { paths } }),
    enabled: paths.length > 0,
  });
  const photoFor = (p: string | null) => (p ? (photos?.urls[p] ?? null) : null);

  const [roll, setRoll] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});

  const [newName, setNewName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["applications"] });
    qc.invalidateQueries({ queryKey: ["dues"] });
  };

  const approve = useMutation({
    mutationFn: approveFn,
    onSuccess: () => {
      toast.success("Application approved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: rejectFn,
    onSuccess: () => {
      toast.success("Application rejected");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const quickAdd = useMutation({
    mutationFn: quickAddFn,
    onSuccess: (res) => {
      toast.success(`Student added with roll number ${res.roll_number}`);
      setNewName("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading applications…</p>;

  const students = data?.students ?? [];
  const pending = students.filter((s) => s.status === "pending");
  const approved = students.filter((s) => s.status === "approved");
  const rejected = students.filter((s) => s.status === "rejected");
  const incomplete = (s: (typeof students)[number]) => !s.branch || !s.phone;

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-card-foreground">Add student</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Register a rider with just a name. The rest of the details can be filled in later.
        </p>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim().length < 2) {
              toast.error("Enter the student's name");
              return;
            }
            quickAdd.mutate({ data: { full_name: newName.trim() } });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="quick-name">Name</Label>
            <Input
              id="quick-name"
              className="w-64"
              value={newName}
              placeholder="Student name"
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={quickAdd.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </form>
      </section>
      <DriverAccessBox />


      <section>
        <h2 className="text-lg font-semibold text-foreground">
          Pending applications{" "}
          <Badge variant="secondary" className="ml-2">
            {pending.length}
          </Badge>
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing waiting for approval.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {pending.map((s) => (
              <div key={s.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex gap-4">
                    {photoFor(s.photo_path) ? (
                      <img
                        src={photoFor(s.photo_path) as string}
                        alt={`Passport photo of ${s.full_name}`}
                        className="h-20 w-16 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-16 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                        No photo
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-card-foreground">
                        #{s.application_no} · {s.full_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {s.branch} · {s.year_of_study} · {s.stage} · {s.boarding_point}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {s.email} · {s.phone}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Guardian: {s.guardian_name} ({s.guardian_phone})
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Applied {formatDate(s.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Roll number</label>
                      <Input
                        className="w-32"
                        value={roll[s.id] ?? data?.nextRoll ?? ""}
                        onChange={(e) => setRoll({ ...roll, [s.id]: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Date of joining</label>
                      <Input
                        type="date"
                        className="w-40"
                        max={todayISO()}
                        value={joining[s.id] ?? todayISO()}
                        onChange={(e) => setJoining({ ...joining, [s.id]: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Fine amount (₹)</label>
                      <Input
                        className="w-28"
                        inputMode="numeric"
                        value={fine[s.id] ?? String(defaultsFor(s.stage).fine)}
                        onChange={(e) => setFine({ ...fine, [s.id]: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Superfine amount (₹)</label>
                      <Input
                        className="w-32"
                        inputMode="numeric"
                        value={superfine[s.id] ?? String(defaultsFor(s.stage).superfine)}
                        onChange={(e) => setSuperfine({ ...superfine, [s.id]: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Maximum advance (₹)</label>
                      <Input
                        className="w-32"
                        inputMode="numeric"
                        value={advance[s.id] ?? String(defaultsFor(s.stage).advance)}
                        onChange={(e) => setAdvance({ ...advance, [s.id]: e.target.value })}
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={approve.isPending}
                      onClick={() => {
                        const d = defaultsFor(s.stage);
                        approve.mutate({
                          data: {
                            id: s.id,
                            roll_number: (roll[s.id] ?? data?.nextRoll ?? "").trim(),
                            date_of_joining: joining[s.id] ?? todayISO(),
                            fine_amount: Number(fine[s.id] ?? d.fine) || 0,
                            superfine_amount: Number(superfine[s.id] ?? d.superfine) || 0,
                            advance_amount: Number(advance[s.id] ?? d.advance) || 0,
                          },
                        });
                      }}
                    >
                      <Check className="mr-1 h-4 w-4" /> Approve
                    </Button>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Rejection remarks</label>
                      <Input
                        className="w-56"
                        placeholder="Reason shown to the student"
                        value={reason[s.id] ?? ""}
                        onChange={(e) => setReason({ ...reason, [s.id]: e.target.value })}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reject.isPending}
                      onClick={() =>
                        reject.mutate({
                          data: { id: s.id, reason: (reason[s.id] ?? "").trim() },
                        })
                      }
                    >
                      <X className="mr-1 h-4 w-4" /> Reject
                    </Button>

                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">
          Student roster{" "}
          <Badge variant="secondary" className="ml-2">
            {approved.length}
          </Badge>
        </h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/60 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Photo</th>
                <th className="px-4 py-3 font-medium">Roll</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Boarding point</th>
                <th className="px-4 py-3 font-medium">Last paid fee</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {approved.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                    No approved students yet.
                  </td>
                </tr>
              ) : (
                approved.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={`cursor-pointer hover:bg-muted/40 ${
                      s.blacklisted ? "bg-destructive/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      {photoFor(s.photo_path) ? (
                        <img
                          src={photoFor(s.photo_path) as string}
                          alt={`Passport photo of ${s.full_name}`}
                          className="h-10 w-8 rounded border border-border object-cover"
                        />
                      ) : (
                        <div className="h-10 w-8 rounded border border-dashed border-border" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{s.roll_number}</td>
                    <td className="px-4 py-3">
                      {s.full_name}
                      {incomplete(s) ? (
                        <Badge variant="outline" className="ml-2">
                          Details incomplete
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.boarding_point ?? "—"}</td>
                    <td className="px-4 py-3">
                      {s.last_payment ? (
                        <span className="text-muted-foreground">
                          {formatINR(Number(s.last_payment.total_amount))} ·{" "}
                          {periodLabel(s.last_payment.period)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.blacklisted ? (
                        <Badge variant="destructive">Blacklisted</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {rejected.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-foreground">Rejected</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {rejected.map((s) => (
              <li key={s.id}>
                #{s.application_no} · {s.full_name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <MasterResetBox />

      <StudentDetailDialog studentId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

/** Admin-only: wipe every student and financial record for a fresh start. */
function MasterResetBox() {
  const resetFn = useServerFn(masterReset);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  const reset = useMutation({
    mutationFn: resetFn,
    onSuccess: () => {
      toast.success("Database reset — all student and financial records cleared");
      setOpen(false);
      setConfirm("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-destructive">
        <AlertTriangle className="h-5 w-5" /> Master reset
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Permanently deletes every student, payment, advance, expense, other income and
        transaction, and clears uploaded photos. Admin and driver logins are kept.
      </p>
      <Button className="mt-4" variant="destructive" onClick={() => setOpen(true)}>
        Reset all data
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset the whole database?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Type RESET to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirm}
            placeholder="RESET"
            onChange={(e) => setConfirm(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirm !== "RESET" || reset.isPending}
              onClick={() => reset.mutate({ data: { confirm: "RESET" as const } })}
            >
              Delete everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}


/** Admin-only: give or remove driver access for an existing account. */
function DriverAccessBox() {
  const listFn = useServerFn(listDrivers);
  const grantFn = useServerFn(grantDriver);
  const revokeFn = useServerFn(revokeDriver);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const drivers = useQuery({ queryKey: ["drivers"], queryFn: () => listFn() });

  const grant = useMutation({
    mutationFn: grantFn,
    onSuccess: (r) => {
      toast.success(`${r.email} can now use the Driver tab`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["drivers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: revokeFn,
    onSuccess: () => {
      toast.success("Driver access removed");
      qc.invalidateQueries({ queryKey: ["drivers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-card-foreground">Driver access</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The driver signs up with their own email and password first. Enter that email here to
        give them the Driver tab.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) {
            toast.error("Enter the driver's email");
            return;
          }
          grant.mutate({ data: { email: email.trim() } });
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="driver-email">Driver email</Label>
          <Input
            id="driver-email"
            type="email"
            className="w-72"
            value={email}
            placeholder="driver@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={grant.isPending}>
          Make driver
        </Button>
      </form>

      <div className="mt-4 space-y-2">
        {drivers.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (drivers.data?.drivers ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No driver account yet.</p>
        ) : (
          (drivers.data?.drivers ?? []).map((d) => (
            <div
              key={d.user_id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <span className="text-sm text-foreground">{d.email ?? d.user_id}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate({ data: { user_id: d.user_id } })}
              >
                Remove
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
