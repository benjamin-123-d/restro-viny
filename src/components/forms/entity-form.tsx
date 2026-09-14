"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { humanError } from "@/lib/error-messages";
import type { ActionResult } from "@/types";

/**
 * One form component for every master record (supplier, customer, warehouse,
 * account…). Each screen describes its fields as data; this renders them,
 * collects the values, and shows the server's field errors in place.
 */

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "textarea"
  | "select"
  | "checkbox";

export interface FieldOption {
  readonly value: string;
  readonly label: string;
}

export interface FieldConfig {
  readonly name: string;
  readonly label: string;
  readonly type: FieldType;
  readonly required?: boolean;
  readonly placeholder?: string;
  /** One line under the field saying what to put in it. */
  readonly hint?: string;
  readonly options?: readonly FieldOption[];
  readonly defaultValue?: string | number | boolean;
  /** Grid span: "full" takes the whole row. */
  readonly span?: "half" | "full";
  readonly min?: number;
  readonly step?: string;
}

export interface FieldSection {
  readonly title: string;
  readonly description?: string;
  readonly fields: readonly FieldConfig[];
}

type Values = Record<string, string | boolean>;

const initialValues = (sections: readonly FieldSection[]): Values => {
  const values: Values = {};
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === "checkbox") {
        values[field.name] = Boolean(field.defaultValue);
      } else {
        values[field.name] =
          field.defaultValue === undefined ? "" : String(field.defaultValue);
      }
    }
  }
  return values;
};

/**
 * Turn form strings into what the Zod schemas expect: blank optional fields
 * become undefined (so `.optional()` accepts them), numbers stay strings for
 * `z.coerce`, checkboxes stay booleans.
 */
const toPayload = (
  sections: readonly FieldSection[],
  values: Values,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  for (const section of sections) {
    for (const field of section.fields) {
      const value = values[field.name];
      if (field.type === "checkbox") {
        payload[field.name] = Boolean(value);
      } else if (typeof value === "string" && value.trim() !== "") {
        payload[field.name] = value.trim();
      }
    }
  }
  return payload;
};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-100";

export const EntityForm = ({
  sections,
  action,
  submitLabel,
  successMessage,
  redirectTo,
  extraPayload,
}: {
  sections: readonly FieldSection[];
  action: (input: unknown) => Promise<ActionResult<unknown>>;
  submitLabel: string;
  successMessage: string;
  /** Where to go once saved; the list page, usually. */
  redirectTo: string;
  /** Fixed values merged into the payload, e.g. the id when editing. */
  extraPayload?: Record<string, unknown>;
}) => {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => initialValues(sections));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (name: string, value: string | boolean) =>
    setValues((current) => ({ ...current, [name]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await action({
        ...toPayload(sections, values),
        ...extraPayload,
      });
      if (!result.success) {
        setError(humanError(result.error));
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setSaved(true);
      router.push(redirectTo);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      {sections.map((section) => (
        <fieldset
          key={section.title}
          className="rounded-lg border bg-white p-5"
          disabled={pending}
        >
          <legend className="px-1 text-sm font-semibold text-zinc-900">
            {section.title}
          </legend>
          {section.description && (
            <p className="-mt-1 mb-4 text-xs text-zinc-500">
              {section.description}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map((field) => {
              const errors = fieldErrors[field.name];
              const id = `field-${field.name}`;
              const span = field.span === "full" || field.type === "textarea";

              if (field.type === "checkbox") {
                return (
                  <label
                    key={field.name}
                    htmlFor={id}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 p-3 hover:bg-zinc-50 ${
                      span ? "sm:col-span-2" : ""
                    }`}
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={Boolean(values[field.name])}
                      onChange={(e) => set(field.name, e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-blue-600"
                    />
                    <span>
                      <span className="block text-sm font-medium text-zinc-800">
                        {field.label}
                      </span>
                      {field.hint && (
                        <span className="block text-xs text-zinc-500">
                          {field.hint}
                        </span>
                      )}
                    </span>
                  </label>
                );
              }

              return (
                <div key={field.name} className={span ? "sm:col-span-2" : ""}>
                  <label
                    htmlFor={id}
                    className="mb-1 block text-sm font-medium text-zinc-800"
                  >
                    {field.label}
                    {field.required && (
                      <span className="ml-0.5 text-red-600" aria-hidden>
                        *
                      </span>
                    )}
                  </label>

                  {field.type === "textarea" ? (
                    <textarea
                      id={id}
                      rows={3}
                      value={String(values[field.name] ?? "")}
                      placeholder={field.placeholder}
                      onChange={(e) => set(field.name, e.target.value)}
                      aria-invalid={Boolean(errors)}
                      className={inputClass}
                    />
                  ) : field.type === "select" ? (
                    <select
                      id={id}
                      value={String(values[field.name] ?? "")}
                      onChange={(e) => set(field.name, e.target.value)}
                      aria-invalid={Boolean(errors)}
                      className={inputClass}
                    >
                      <option value="">
                        {field.required ? "— Choisir —" : "— Aucun —"}
                      </option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={id}
                      type={field.type}
                      value={String(values[field.name] ?? "")}
                      placeholder={field.placeholder}
                      min={field.min}
                      step={field.step}
                      onChange={(e) => set(field.name, e.target.value)}
                      aria-invalid={Boolean(errors)}
                      className={inputClass}
                    />
                  )}

                  {errors ? (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      {errors.join(" · ")}
                    </p>
                  ) : (
                    field.hint && (
                      <p className="mt-1 text-xs leading-snug text-zinc-500">
                        {field.hint}
                      </p>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.push(redirectTo)}
          className="rounded-md border px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Annuler
        </button>
        <span className="text-xs text-zinc-500">
          <span className="text-red-600">*</span> champ obligatoire
        </span>
      </div>
    </form>
  );
};
