import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Clock, Upload, XCircle } from "lucide-react";
import { myFeeStatus, setMyPhoto, submitRegistration } from "@/lib/bus.functions";
import { STAGES, YEARS, registrationSchema } from "@/lib/bus-schemas";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAGE_LABEL, formatDate, formatINR, periodLabel } from "@/lib/fee-rules";

type Section = "all" | "registration" | "fees";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

async function uploadPhoto(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|jpg|webp)$/.test(file.type)) {
    throw new Error("Upload a JPG or PNG photo");
  }
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Photo must be under 2 MB");
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You are signed out");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${uid}/passport-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("student-photos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

function useSignedPhoto(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from("student-photos")
      .createSignedUrl(path, 600)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

export function StudentPortal({ section = "all" }: { section?: Section }) {
  const fetchStatus = useServerFn(myFeeStatus);
  const register = useServerFn(submitRegistration);
  const savePhoto = useServerFn(setMyPhoto);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-fee-status"],
    queryFn: () => fetchStatus(),
  });

  const [showForm, setShowForm] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    branch: "",
    year_of_study: "",
    stage: "",
    address: "",
    boarding_point: "",
    guardian_name: "",
    guardian_phone: "",
  });

  const submit = useMutation({
    mutationFn: async (values: typeof form) => {
      const parsed = registrationSchema.safeParse(values);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the form");
      const photo_path = photoFile ? await uploadPhoto(photoFile) : undefined;
      return register({ data: { ...parsed.data, ...(photo_path ? { photo_path } : {}) } });
    },
    onSuccess: () => {
      toast.success("Registration submitted. The transport office will review it.");
      setShowForm(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      qc.invalidateQueries({ queryKey: ["my-fee-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const replacePhoto = useMutation({
    mutationFn: async (file: File) => {
      const path = await uploadPhoto(file);
      return savePhoto({ data: { photo_path: path } });
    },
    onSuccess: () => {
      toast.success("Photo updated");
      qc.invalidateQueries({ queryKey: ["my-fee-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const student = data?.student ?? null;
  const photoUrl = useSignedPhoto(student?.photo_path);

  const [authEmail, setAuthEmail] = useState("");
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: u }) => {
      const mail = u.user?.email ?? "";
      if (!alive || !mail) return;
      setAuthEmail(mail);
      setForm((f) => (f.email === mail ? f : { ...f, email: mail }));
    });
    return () => {
      alive = false;
    };
  }, []);

  const startResubmit = () => {
    if (!student) return;
    setForm({
      full_name: student.full_name ?? "",
      email: authEmail || student.email || "",
      phone: student.phone ?? "",
      branch: student.branch ?? "",
      year_of_study: student.year_of_study ?? "",
      stage: student.stage ?? "",
      address: student.address ?? "",
      boarding_point: student.boarding_point ?? "",
      guardian_name: student.guardian_name ?? "",
      guardian_phone: student.guardian_phone ?? "",
    });
    setShowForm(true);
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!student || (student.status === "rejected" && showForm)) {
    if (!student && section === "fees") {
      return (
        <p className="rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
          Register for the bus from the Registration tab to see your fee details.
        </p>
      );
    }

    if (!showForm) {
      return (
        <section className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-card-foreground">Bus registration</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            You have not registered for the college bus yet. Start your application whenever
            you are ready — it only takes a minute.
          </p>
          <Button className="mt-6" onClick={() => setShowForm(true)}>
            Register for the bus
          </Button>
        </section>
      );
    }

    return (
      <form
        className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate(form);
        }}
      >
        <h2 className="text-xl font-semibold text-card-foreground">Bus registration</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill this once. Your roll number and fee slab are assigned by the transport office
          when your application is approved.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Text label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <Text
            label="Email"
            type="email"
            value={form.email}
            readOnly
            hint="Your sign-in email. Contact the transport office to change it."
            onChange={() => {}}
          />

          <Text label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Text label="Branch" value={form.branch} onChange={(v) => setForm({ ...form, branch: v })} />
          <Pick
            label="Year of study"
            placeholder="Select year"
            options={YEARS}
            value={form.year_of_study}
            onChange={(v) => setForm({ ...form, year_of_study: v })}
          />
          <Pick
            label="Stage"
            placeholder="Select stage"
            options={STAGES}
            value={form.stage}
            onChange={(v) => setForm({ ...form, stage: v })}
          />
          <Text
            label="Boarding point"
            value={form.boarding_point}
            onChange={(v) => setForm({ ...form, boarding_point: v })}
          />
          <Text
            label="Guardian name"
            value={form.guardian_name}
            onChange={(v) => setForm({ ...form, guardian_name: v })}
          />
          <Text
            label="Guardian phone"
            value={form.guardian_phone}
            onChange={(v) => setForm({ ...form, guardian_phone: v })}
          />
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="addr">Address</Label>
            <Textarea
              id="addr"
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="photo">Passport photo</Label>
            <div className="flex items-center gap-4">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Passport photo preview"
                  className="h-20 w-16 rounded-md border border-border object-cover"
                />
              ) : (
                <div className="flex h-20 w-16 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                  <Upload className="h-4 w-4" />
                </div>
              )}
              <Input
                id="photo"
                type="file"
                accept="image/png,image/jpeg"
                className="max-w-xs"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setPhotoFile(file);
                  setPhotoPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">JPG or PNG, up to 2 MB. Optional.</p>
          </div>
        </div>

        <Button type="submit" className="mt-6" disabled={submit.isPending}>
          {submit.isPending ? "Submitting…" : "Submit registration"}
        </Button>
      </form>
    );
  }

  const current = data?.current ?? null;
  const history = data?.history ?? [];

  const showRegistration = section === "all" || section === "registration";
  const showFees = section === "all" || section === "fees";

  return (
    <div className="space-y-8">
      {showRegistration ? (
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="space-y-2">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={`Passport photo of ${student.full_name}`}
                  className="h-24 w-20 rounded-md border border-border object-cover"
                />
              ) : (
                <div className="flex h-24 w-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  No photo
                </div>
              )}
              <input
                ref={replaceRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) replacePhoto.mutate(file);
                }}
              />
              <button
                type="button"
                className="text-xs font-medium text-primary underline underline-offset-2"
                disabled={replacePhoto.isPending}
                onClick={() => replaceRef.current?.click()}
              >
                {replacePhoto.isPending
                  ? "Uploading…"
                  : student.photo_path
                    ? "Update photo"
                    : "Upload passport photo"}
              </button>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-card-foreground">{student.full_name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Application #{student.application_no}
                {student.branch ? ` · ${student.branch}` : ""}
                {student.year_of_study ? ` · ${student.year_of_study}` : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {student.boarding_point ? `Boarding at ${student.boarding_point} · ` : ""}
                {student.stage} · {student.slab} slab
              </p>
            </div>
          </div>
          <div className="text-right">
            <StatusBadge status={student.status} />
            {student.roll_number ? (
              <p className="mt-2 text-2xl font-semibold text-card-foreground">
                {student.roll_number}
              </p>
            ) : null}
            {student.blacklisted ? (
              <Badge variant="destructive" className="mt-2">
                Blacklisted
              </Badge>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}

      {showRegistration && student.status === "pending" ? (
        <p className="rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
          <Clock className="mr-2 inline h-4 w-4" />
          Your application is waiting for approval from the transport office.
        </p>
      ) : null}

      {showRegistration && student.status === "rejected" ? (
        <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
          <h3 className="text-sm font-semibold text-foreground">Application rejected</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {student.rejection_reason
              ? `Remarks from the transport office: ${student.rejection_reason}`
              : "The transport office did not add any remarks."}
          </p>
          <Button className="mt-4" onClick={startResubmit}>
            Edit and resubmit application
          </Button>
        </section>
      ) : null}


      {showFees && student.status === "approved" ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold text-card-foreground">This month's fee</h3>
          {!current ? (
            <p className="mt-3 text-sm text-muted-foreground">
              The fee amount for this month has not been published yet.
            </p>
          ) : current.paid ? (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-accent" />
              Paid {formatINR(Number(current.paid.total_amount))} · receipt{" "}
              {current.paid.receipt_no}
            </div>
          ) : (
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Period" value={periodLabel(current.period)} />
              <Row label="Base fee" value={formatINR(current.base)} />
              <Row label="Penalty" value={current.penalty ? formatINR(current.penalty) : "—"} />
              <Row label="Payable now" value={formatINR(current.total)} />
              <Row label="Stage" value={STAGE_LABEL[current.stage]} />
              <Row label="Due date" value={formatDate(current.dueDate)} />
              <Row label="Fine till" value={formatDate(current.fineUntil)} />
              <Row label="Superfine till" value={formatDate(current.superfineUntil)} />
            </dl>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Pay at the transport office counter. Your receipt appears here once recorded.
          </p>
        </section>
      ) : null}

      {showFees ? (
      <section>
        <h3 className="text-lg font-semibold text-foreground">Payment history</h3>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/60 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 font-medium">Receipt</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Paid on</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                    No payments recorded yet.
                  </td>
                </tr>
              ) : (
                history.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{periodLabel(p.period)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.receipt_no}</td>
                    <td className="px-4 py-3 font-medium">{formatINR(Number(p.total_amount))}</td>
                    <td className="px-4 py-3">{STAGE_LABEL[p.stage]}</td>
                    <td className="px-4 py-3">{formatDate(p.value_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return (
      <Badge variant="secondary">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Approved
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" /> Rejected
      </Badge>
    );
  return (
    <Badge>
      <Clock className="mr-1 h-3 w-3" /> Pending
    </Badge>
  );
}

function Text({
  label,
  value,
  onChange,
  type = "text",
  readOnly = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        required
        readOnly={readOnly}
        aria-readonly={readOnly}
        className={readOnly ? "bg-muted text-muted-foreground" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}


function Pick({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-card-foreground">{value}</dd>
    </div>
  );
}
