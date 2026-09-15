"use client";

import { useState } from "react";

import { toast } from "sonner";

import { createStaffAction, updateStaffAction } from "@/actions/staff.actions";
import { PhoneInput } from "@/components/phone-input";
import { StaffPhotoUploader } from "@/components/staff/staff-photo-uploader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useServerAction } from "@/hooks/use-server-action";
import {
  EMPLOYMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  STAFF_ROLE_OPTIONS,
  STAFF_STATUS_OPTIONS,
} from "@/lib/staff";
import type {
  EmploymentType,
  Gender,
  StaffDTO,
  StaffRole,
  StaffStatus,
} from "@/types/staff";

const trimmed = (value: string) => value.trim() || undefined;

export function StaffDialog({
  staff,
  onOpenChange,
  onSaved,
}: {
  readonly staff: StaffDTO | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
}) {
  const [form, setForm] = useState({
    employeeCode: staff?.employeeCode ?? "",
    name: staff?.name ?? "",
    phone: staff?.phone ?? "",
    email: staff?.email ?? "",
    addressLine1: staff?.addressLine1 ?? "",
    addressLine2: staff?.addressLine2 ?? "",
    city: staff?.city ?? "",
    state: staff?.state ?? "",
    postalCode: staff?.postalCode ?? "",
    dateOfBirth: staff?.dateOfBirth?.slice(0, 10) ?? "",
    joiningDate: staff?.joiningDate?.slice(0, 10) ?? "",
    emergencyContactName: staff?.emergencyContactName ?? "",
    emergencyContactPhone: staff?.emergencyContactPhone ?? "",
    notes: staff?.notes ?? "",
  });
  const [role, setRole] = useState<StaffRole>(staff?.role ?? "WAITER");
  const [status, setStatus] = useState<StaffStatus>(staff?.status ?? "ACTIVE");
  const [gender, setGender] = useState<Gender | "">(staff?.gender ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">(
    staff?.employmentType ?? "",
  );
  const [pin, setPin] = useState("");

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const setPhone = (phone: string) => setForm((prev) => ({ ...prev, phone }));

  const save = useServerAction(staff ? updateStaffAction : createStaffAction, {
    onSuccess: () => {
      toast.success(staff ? "Membre modifié" : "Membre ajouté");
      onOpenChange(false);
      onSaved();
    },
    onError: (message) => toast.error(message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const base = {
      employeeCode: form.employeeCode.trim(),
      name: form.name.trim(),
      role,
      status,
      phone: form.phone.trim(),
      email: trimmed(form.email),
      addressLine1: trimmed(form.addressLine1),
      addressLine2: trimmed(form.addressLine2),
      city: trimmed(form.city),
      state: trimmed(form.state),
      postalCode: trimmed(form.postalCode),
      dateOfBirth: form.dateOfBirth || undefined,
      gender: gender || undefined,
      joiningDate: form.joiningDate || undefined,
      employmentType: employmentType || undefined,
      emergencyContactName: trimmed(form.emergencyContactName),
      emergencyContactPhone: trimmed(form.emergencyContactPhone),
      notes: trimmed(form.notes),
    };
    save.execute(staff ? { ...base, id: staff.id } : { ...base, pin });
  };

  const pinValid = /^\d{4,6}$/.test(pin);
  const disabled =
    save.isPending ||
    !form.employeeCode.trim() ||
    !form.name.trim() ||
    !form.phone.trim() ||
    (!staff && !pinValid);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{staff ? "Modifier le membre" : "Nouveau membre du personnel"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5">
          {staff ? (
            <StaffPhotoUploader staffId={staff.id} photoUrl={staff.photoUrl} />
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="st-code">Employee ID</FieldLabel>
              <Input
                id="st-code"
                value={form.employeeCode}
                onChange={set("employeeCode")}
                placeholder="E-001"
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="st-name">Full name</FieldLabel>
              <Input
                id="st-name"
                value={form.name}
                onChange={set("name")}
                placeholder="Ramesh Kumar"
              />
            </Field>
            <Field className="col-span-2">
              <FieldLabel htmlFor="st-phone">Téléphone</FieldLabel>
              <PhoneInput
                id="st-phone"
                initialValue={staff?.phone}
                onChange={setPhone}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="st-role">Rôle</FieldLabel>
              <Select value={role} onValueChange={(v) => v && setRole(v as StaffRole)}>
                <SelectTrigger id="st-role">
                  <span>
                    {STAFF_ROLE_OPTIONS.find((o) => o.value === role)?.label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="st-status">Statut</FieldLabel>
              <Select
                value={status}
                onValueChange={(v) => v && setStatus(v as StaffStatus)}
              >
                <SelectTrigger id="st-status">
                  <span>
                    {STAFF_STATUS_OPTIONS.find((o) => o.value === status)?.label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {STAFF_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {staff ? null : (
            <Field>
              <FieldLabel htmlFor="st-pin">Code PIN caisse (4 à 6 chiffres)</FieldLabel>
              <Input
                id="st-pin"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••"
              />
              <p className="text-muted-foreground text-xs">
                Utilisé à la caisse. Ce n'est pas un mot de passe de connexion.
              </p>
            </Field>
          )}

          <div className="border-border/60 flex flex-col gap-3 border-t pt-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Contact & personal
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field className="col-span-2">
                <FieldLabel htmlFor="st-email">E-mail</FieldLabel>
                <Input
                  id="st-email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="Optional"
                />
              </Field>
              <Field className="col-span-2">
                <FieldLabel htmlFor="st-addr1">Adresse</FieldLabel>
                <Input
                  id="st-addr1"
                  value={form.addressLine1}
                  onChange={set("addressLine1")}
                  placeholder="Street / area"
                />
              </Field>
              <Field className="col-span-2">
                <Input
                  aria-label="Complément d'adresse"
                  value={form.addressLine2}
                  onChange={set("addressLine2")}
                  placeholder="Bâtiment, étage (facultatif)"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="st-city">City</FieldLabel>
                <Input id="st-city" value={form.city} onChange={set("city")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="st-state">State</FieldLabel>
                <Input id="st-state" value={form.state} onChange={set("state")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="st-postal">Postal code</FieldLabel>
                <Input
                  id="st-postal"
                  value={form.postalCode}
                  onChange={set("postalCode")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="st-dob">Date de naissance</FieldLabel>
                <Input
                  id="st-dob"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={set("dateOfBirth")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="st-gender">Gender</FieldLabel>
                <Select
                  value={gender || undefined}
                  onValueChange={(v) => setGender((v as Gender) ?? "")}
                >
                  <SelectTrigger id="st-gender">
                    <span>
                      {GENDER_OPTIONS.find((o) => o.value === gender)?.label ??
                        "Choisir"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          <div className="border-border/60 flex flex-col gap-3 border-t pt-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Employment
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="st-joining">Joining date</FieldLabel>
                <Input
                  id="st-joining"
                  type="date"
                  value={form.joiningDate}
                  onChange={set("joiningDate")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="st-emp">Employment type</FieldLabel>
                <Select
                  value={employmentType || undefined}
                  onValueChange={(v) => setEmploymentType((v as EmploymentType) ?? "")}
                >
                  <SelectTrigger id="st-emp">
                    <span>
                      {EMPLOYMENT_TYPE_OPTIONS.find(
                        (o) => o.value === employmentType,
                      )?.label ?? "Choisir"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="st-ec-name">Emergency contact</FieldLabel>
                <Input
                  id="st-ec-name"
                  value={form.emergencyContactName}
                  onChange={set("emergencyContactName")}
                  placeholder="Nom"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="st-ec-phone">Emergency phone</FieldLabel>
                <Input
                  id="st-ec-phone"
                  value={form.emergencyContactPhone}
                  onChange={set("emergencyContactPhone")}
                  placeholder="Téléphone"
                />
              </Field>
              <Field className="col-span-2">
                <FieldLabel htmlFor="st-notes">Remarques</FieldLabel>
                <Textarea
                  id="st-notes"
                  value={form.notes}
                  onChange={set("notes")}
                  rows={2}
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={disabled}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
