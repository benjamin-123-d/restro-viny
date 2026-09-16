import type {
  EmploymentType,
  Gender,
  StaffRole,
  StaffStatus,
} from "@/types/staff";

/**
 * How the team is named on screen. The trades are named after the job as it is
 * said in a French kitchen — « salle » and « cuisine », not « waiter » and
 * « kitchen ».
 */
export const STAFF_ROLE_OPTIONS: readonly { value: StaffRole; label: string }[] = [
  { value: "WAITER", label: "Salle" },
  { value: "KITCHEN", label: "Cuisine" },
  { value: "MANAGEMENT", label: "Encadrement" },
];

export const STAFF_STATUS_OPTIONS: readonly {
  value: StaffStatus;
  label: string;
}[] = [
  { value: "ACTIVE", label: "En poste" },
  { value: "ON_LEAVE", label: "En congé" },
  { value: "INACTIVE", label: "Parti" },
];

export const EMPLOYMENT_TYPE_OPTIONS: readonly {
  value: EmploymentType;
  label: string;
}[] = [
  { value: "FULL_TIME", label: "Temps plein" },
  { value: "PART_TIME", label: "Temps partiel" },
  { value: "CONTRACT", label: "Extra / contrat" },
];

export const GENDER_OPTIONS: readonly { value: Gender; label: string }[] = [
  { value: "MALE", label: "Homme" },
  { value: "FEMALE", label: "Femme" },
  { value: "OTHER", label: "Autre" },
];

export const staffRoleLabel = (role: StaffRole): string =>
  STAFF_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;

export const staffStatusLabel = (status: StaffStatus): string =>
  STAFF_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
