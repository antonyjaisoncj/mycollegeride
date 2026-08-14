import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, ShieldCheck, ShieldOff, Upload } from "lucide-react";
import { studentDetail, setBlacklist, updateStudent } from "@/lib/bus.functions";
import { STAGES, YEARS, updateStudentSchema } from "@/lib/bus-schemas";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { formatDate, formatINR, periodLabel } from "@/lib/fee-rules";

interface Props {
  studentId: string | null;
  onClose: () => void;
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

async function uploadStudentPhoto(studentId: string, file: File): Promise<string> {
  if (!/^image\/(jpeg|png|jpg|webp)$/.test(file.type)) {
    throw new Error("Upload a JPG or PNG photo");
  }
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Photo must be under 2 MB");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${studentId}/passport-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("student-photos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

type FormState = {
  full_name: string;
  email: string;
  phone: string;
  branch: string;
  year_of_study: string;
  stage: string;
  address: string;
  boarding_point: string;
  guardian_name: string;
  guardian_phone: string;
  roll_number: string;
  date_of_joining: string;
};

const EMPTY: FormState = {
  full_name: "",
  email: "",
  phone: "",
  branch: "",
  year_of_study: "",
  stage: "Stage-1",
  address: "",
  boarding_point: "",
  guardian_name: "",
  guardian_phone: "",
  roll_number: "",
  date_of_joining: "",
};


export function StudentDetailDialog({ studentId, onClose }: Props) {
  const fetchDetail = useServerFn(studentDetail);
  const blacklistFn = useServerFn(setBlacklist);
  const saveFn = useServerFn(updateStudent);
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["student-detail", studentId],
    queryFn: () => fetchDetail({ data: { id: studentId! } }),
    enabled: Boolean(studentId),
  });

  const student = data?.student;

  useEffect(() => {
    setEditing(false);
    setPhotoFile(null);
    setPhotoPreview(null);
  }, [studentId]);

  const startEdit = () => {
    if (!student) return;
    setForm({
      full_name: student.full_name ?? "",
      email: student.email ?? "",
      phone: student.phone ?? "",
      branch: student.branch ?? "",
      year_of_study: student.year_of_study ?? "",
      stage: student.stage ?? "Stage-1",
      address: student.address ?? "",
      boarding_point: student.boarding_point ?? "",
      guardian_name: student.guardian_name ?? "",
      guardian_phone: student.guardian_phone ?? "",
      roll_number: student.roll_number ?? "",
      date_of_joining: student.date_of_joining ?? "",

    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setEditing(true);
  };

  const set = (key: keyof FormState) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      if (!student) throw new Error("No student loaded");
      const photo_path = photoFile
        ? await uploadStudentPhoto(student.id, photoFile)
        : (student.photo_path ?? null);
      const parsed = updateStudentSchema.safeParse({ ...form, id: student.id, photo_path });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Check the form");
      }
      return saveFn({ data: parsed.data });
    },
    onSuccess: () => {
      toast.success("Student updated");
      setEditing(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      qc.invalidateQueries({ queryKey: ["student-detail", studentId] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["dues"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const blacklist = useMutation({
    mutationFn: blacklistFn,
    onSuccess: () => {
      toast.success("Blacklist updated");
      qc.invalidateQueries({ queryKey: ["student-detail", studentId] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["dues"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payments = data?.payments ?? [];
  const totalPaid = payments.reduce((a, p) => a + Number(p.total_amount), 0);

  return (
    <Dialog open={Boolean(studentId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Student details</DialogTitle>
        </DialogHeader>

        {isLoading || !student ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              {photoPreview ?? data?.photoUrl ? (
                <img
                  src={photoPreview ?? data?.photoUrl ?? ""}
                  alt={`Passport photo of ${student.full_name}`}
                  className="h-24 w-20 rounded-md border border-border object-cover"
                />
              ) : (
                <div className="flex h-24 w-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  No photo
                </div>
              )}
              <div className="flex-1">
                <p className="text-lg font-semibold text-foreground">
                  {student.full_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Roll {student.roll_number ?? "—"} · App #{student.application_no}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {student.branch ?? "No branch"} · {student.year_of_study ?? "No year"} ·{" "}
                  {student.stage}
                </p>
                <p className="text-sm text-muted-foreground">
                  Boarding point: {student.boarding_point ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Date of joining:{" "}
                  {student.date_of_joining ? formatDate(student.date_of_joining) : "—"}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {student.blacklisted ? (
                    <Badge variant="destructive">Blacklisted</Badge>
                  ) : student.status === "approved" ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : student.status === "rejected" ? (
                    <Badge variant="outline">Rejected</Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                  {data?.canEdit && !editing && (
                    <Button size="sm" variant="outline" onClick={startEdit}>
                      <Pencil className="mr-1 h-4 w-4" /> Edit
                    </Button>
                  )}
                  {data?.canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={blacklist.isPending}
                      onClick={() =>
                        blacklist.mutate({
                          data: { id: student.id, blacklisted: !student.blacklisted },
                        })
                      }
                    >
                      {student.blacklisted ? (
                        <>
                          <ShieldCheck className="mr-1 h-4 w-4" /> Clear
                        </>
                      ) : (
                        <>
                          <ShieldOff className="mr-1 h-4 w-4" /> Blacklist
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {editing && data?.canEdit && (
              <section className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">Edit student</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="e-name">Full name</Label>
                    <Input
                      id="e-name"
                      value={form.full_name}
                      onChange={(e) => set("full_name")(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="e-roll">Roll number</Label>
                    <Input
                      id="e-roll"
                      value={form.roll_number}
                      onChange={(e) => set("roll_number")(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="e-email">Email</Label>
                    <Input
                      id="e-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email")(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="e-phone">Phone</Label>
                    <Input
                      id="e-phone"
                      value={form.phone}
                      onChange={(e) => set("phone")(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="e-branch">Branch</Label>
                    <Input
                      id="e-branch"
                      value={form.branch}
                      onChange={(e) => set("branch")(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Year of study</Label>
                    <Select value={form.year_of_study} onValueChange={set("year_of_study")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map((y) => (
                          <SelectItem key={y} value={y}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Stage</Label>
                    <Select value={form.stage} onValueChange={set("stage")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="e-doj">Date of joining</Label>
                    <Input
                      id="e-doj"
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      value={form.date_of_joining}
                      onChange={(e) => set("date_of_joining")(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="e-boarding">Boarding point</Label>
                    <Input
                      id="e-boarding"
                      value={form.boarding_point}
                      onChange={(e) => set("boarding_point")(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="e-gname">Guardian name</Label>
                    <Input
                      id="e-gname"
                      value={form.guardian_name}
                      onChange={(e) => set("guardian_name")(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="e-gphone">Guardian phone</Label>
                    <Input
                      id="e-gphone"
                      value={form.guardian_phone}
                      onChange={(e) => set("guardian_phone")(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="e-address">Address</Label>
                    <Textarea
                      id="e-address"
                      rows={2}
                      value={form.address}
                      onChange={(e) => set("address")(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="e-photo">Passport photo</Label>
                    <div className="flex items-center gap-3">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="e-photo"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setPhotoFile(file);
                          setPhotoPreview(file ? URL.createObjectURL(file) : null);
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button disabled={save.isPending} onClick={() => save.mutate()}>
                    {save.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold text-foreground">Payment history</h3>
              {payments.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead className="bg-muted/60 text-left text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Month</th>
                        <th className="px-3 py-2 font-medium">Receipt</th>
                        <th className="px-3 py-2 font-medium">Base</th>
                        <th className="px-3 py-2 font-medium">Penalty</th>
                        <th className="px-3 py-2 font-medium">Total</th>
                        <th className="px-3 py-2 font-medium">Stage</th>
                        <th className="px-3 py-2 font-medium">Mode</th>
                        <th className="px-3 py-2 font-medium">Paid on</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2">{periodLabel(p.period)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.receipt_no}</td>
                          <td className="px-3 py-2">{formatINR(Number(p.base_amount))}</td>
                          <td className="px-3 py-2">{formatINR(Number(p.penalty_amount))}</td>
                          <td className="px-3 py-2 font-medium">{formatINR(Number(p.total_amount))}</td>
                          <td className="px-3 py-2 capitalize">{p.stage.replace("_", " ")}</td>
                          <td className="px-3 py-2 uppercase">{p.mode}</td>
                          <td className="px-3 py-2 text-muted-foreground">{formatDate(p.value_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-right text-sm font-semibold text-foreground">
                Total paid: {formatINR(totalPaid)}
              </p>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
