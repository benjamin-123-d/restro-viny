"use client";

import { CheckIcon, TriangleAlertIcon, WandSparklesIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { updateLegalProfileAction } from "@/actions/settings.actions";
import { HelpBox } from "@/components/forms/help-box";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { useServerAction } from "@/hooks/use-server-action";
import { humanError } from "@/lib/error-messages";
import {
  DRINKS_LICENSES,
  formatSiret,
  isValidSiret,
  LEGAL_FORMS,
  RESTAURANT_NAF_CODES,
  vatNumberFromSiret,
} from "@/lib/french-legal";
import {
  formatVatRate,
  RATES_TO_CONFIRM,
  VAT_CATEGORY_LABEL,
  VAT_TERRITORY_LABEL,
  VAT_TERRITORY_NOTE,
  vatRatesFor,
  type ServiceType,
  type VatCategory,
  type VatTerritory,
} from "@/lib/french-vat";
import { cn } from "@/lib/utils";
import type { LegalProfileDTO } from "@/types/settings";

const TERRITORIES = Object.keys(VAT_TERRITORY_LABEL) as VatTerritory[];
const CATEGORIES: VatCategory[] = ["FOOD", "SOFT_DRINK", "ALCOHOL"];
const SERVICES: { key: ServiceType; label: string }[] = [
  { key: "DINE_IN", label: "Sur place" },
  { key: "TAKEAWAY", label: "À emporter" },
  { key: "DELIVERY", label: "Livraison" },
];

type Values = Omit<Record<keyof LegalProfileDTO, string>, "vatTerritory">;

const FIELD_HINTS: Readonly<Record<keyof Values, string>> = {
  legalName: "Le nom officiel de la société, tel qu'il figure sur le Kbis (souvent différent de l'enseigne).",
  legalForm: "SARL, SAS, EI… Obligatoire sur les factures des sociétés.",
  shareCapital: "Montant du capital social, par exemple « 10 000 € ». Laissez vide pour une entreprise individuelle.",
  siret: "14 chiffres : les 9 du SIREN puis les 5 de l'établissement. Sur le Kbis ou l'avis de situation INSEE.",
  vatNumber: "FR + 2 chiffres + SIREN. Visible dans votre espace professionnel impots.gouv.fr.",
  nafCode: "Code d'activité (APE) attribué par l'INSEE, 56.10A pour un restaurant traditionnel.",
  rcs: "Ville du greffe et numéro, par exemple « RCS Lyon 732 829 320 ». Vide si vous n'êtes pas inscrit au RCS.",
  drinksLicense: "La licence affichée dans l'établissement. Elle conditionne les boissons que vous pouvez servir.",
};

function TextField({
  name,
  label,
  value,
  onChange,
  error,
  placeholder,
  list,
  aside,
}: {
  readonly name: keyof Values;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
  readonly placeholder?: string;
  readonly list?: string;
  readonly aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`legal-${name}`} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          id={`legal-${name}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          list={list}
          aria-invalid={Boolean(error)}
          aria-describedby={`legal-${name}-hint`}
        />
        {aside}
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p id={`legal-${name}-hint`} className="text-xs leading-snug text-muted-foreground">
          {FIELD_HINTS[name]}
        </p>
      )}
    </div>
  );
}

export function LegalProfileForm({ profile }: { readonly profile: LegalProfileDTO }) {
  const [territory, setTerritory] = useState<VatTerritory>(profile.vatTerritory);
  const [values, setValues] = useState<Values>({
    legalName: profile.legalName ?? "",
    legalForm: profile.legalForm ?? "",
    shareCapital: profile.shareCapital ?? "",
    siret: profile.siret ? formatSiret(profile.siret) : "",
    vatNumber: profile.vatNumber ?? "",
    nafCode: profile.nafCode ?? "",
    rcs: profile.rcs ?? "",
    drinksLicense: profile.drinksLicense ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (name: keyof Values) => (value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => ({ ...e, [name]: "" }));
  };

  const save = useServerAction(updateLegalProfileAction, {
    refresh: true,
    onSuccess: () => {
      setErrors({});
      toast.success("Mentions légales et territoire enregistrés");
    },
    onError: (message, fieldErrors) => {
      setErrors(Object.fromEntries(Object.entries(fieldErrors ?? {}).map(([k, v]) => [k, v[0] ?? ""])));
      toast.error(humanError(message));
    },
  });

  const rates = vatRatesFor(territory);
  const toConfirm = RATES_TO_CONFIRM.filter((r) => r.territory === territory);
  const siretOk = values.siret.trim() !== "" && isValidSiret(values.siret);
  const derivedVat = siretOk ? vatNumberFromSiret(values.siret) : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>TVA et mentions légales</CardTitle>
          <CardDescription>
            Le territoire fixe les taux de TVA appliqués en caisse ; les mentions s&apos;impriment sur chaque facture.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              save.execute({ vatTerritory: territory, ...values });
            }}
          >
            <HelpBox
              title="Où trouver ces informations ?"
              defaultOpen={!profile.siret}
              steps={[
                "Choisissez le territoire où se trouve le restaurant : les taux de TVA de la caisse changent aussitôt pour les nouvelles commandes.",
                "Recopiez le SIRET, la forme juridique, le capital et le RCS depuis votre extrait Kbis (infogreffe.fr) ou l'avis de situation INSEE.",
                "Le numéro de TVA intracommunautaire se déduit du SIRET : utilisez le bouton « Déduire » puis vérifiez-le sur impots.gouv.fr.",
              ]}
              tips={[
                "Les commandes déjà encaissées gardent le taux avec lequel elles ont été facturées.",
                "En cas de doute sur un taux, demandez confirmation à votre expert-comptable.",
              ]}
            />

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-sm font-semibold">Territoire de TVA</legend>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup">
                {TERRITORIES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={territory === t}
                    onClick={() => setTerritory(t)}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                      territory === t ? "border-foreground bg-muted" : "hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        territory === t && "border-foreground bg-foreground text-background",
                      )}
                      aria-hidden
                    >
                      {territory === t ? <CheckIcon className="size-3" /> : null}
                    </span>
                    <span className="font-medium">{VAT_TERRITORY_LABEL[t]}</span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{VAT_TERRITORY_NOTE[territory]}</p>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <caption className="sr-only">Taux de TVA appliqués en caisse</caption>
                  <thead className="bg-muted/60 text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-medium">Ce qui est vendu</th>
                      {SERVICES.map((s) => (
                        <th key={s.key} scope="col" className="px-3 py-2 text-right font-medium">
                          {s.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CATEGORIES.map((c) => (
                      <tr key={c} className="border-t">
                        <th scope="row" className="px-3 py-2 text-left font-medium">{VAT_CATEGORY_LABEL[c]}</th>
                        {SERVICES.map((s) => {
                          const unsure = toConfirm.some((r) => r.category === c && r.service === s.key);
                          return (
                            <td key={s.key} className="px-3 py-2 text-right tabular-nums">
                              {formatVatRate(rates[c][s.key])}
                              {unsure ? (
                                <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-amber-700 dark:text-amber-400">
                                  <TriangleAlertIcon className="size-3" aria-hidden />à confirmer
                                </span>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-semibold sm:col-span-2">Identité de l&apos;entreprise</legend>
              <TextField name="legalName" label="Raison sociale" value={values.legalName} onChange={set("legalName")} error={errors.legalName} placeholder="Le Bistrot du Port SARL" />
              <TextField name="legalForm" label="Forme juridique" value={values.legalForm} onChange={set("legalForm")} error={errors.legalForm} placeholder="SARL" list="legal-forms" />
              <TextField name="shareCapital" label="Capital social" value={values.shareCapital} onChange={set("shareCapital")} error={errors.shareCapital} placeholder="10 000 €" />
              <TextField name="rcs" label="Immatriculation RCS" value={values.rcs} onChange={set("rcs")} error={errors.rcs} placeholder="RCS Lyon 732 829 320" />
              <TextField
                name="siret"
                label="SIRET"
                value={values.siret}
                onChange={set("siret")}
                error={errors.siret || (values.siret.trim() && !siretOk && values.siret.replace(/\s/g, "").length >= 14 ? "Ce SIRET ne passe pas le contrôle : un chiffre est sans doute faux." : undefined)}
                placeholder="732 829 320 00074"
              />
              <TextField
                name="vatNumber"
                label="N° de TVA intracommunautaire"
                value={values.vatNumber}
                onChange={set("vatNumber")}
                error={errors.vatNumber}
                placeholder="FR44732829320"
                aside={
                  derivedVat && derivedVat !== values.vatNumber.replace(/\s/g, "").toUpperCase() ? (
                    <Button type="button" variant="outline" onClick={() => set("vatNumber")(derivedVat)} title="Calculer le numéro à partir du SIRET">
                      <WandSparklesIcon className="size-4" aria-hidden />
                      Déduire
                    </Button>
                  ) : null
                }
              />
              <TextField name="nafCode" label="Code NAF / APE" value={values.nafCode} onChange={set("nafCode")} error={errors.nafCode} placeholder="56.10A" list="naf-codes" />
              <TextField name="drinksLicense" label="Licence de boissons" value={values.drinksLicense} onChange={set("drinksLicense")} error={errors.drinksLicense} placeholder="Licence restaurant" list="drinks-licenses" />

              <datalist id="legal-forms">
                {LEGAL_FORMS.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
              <datalist id="naf-codes">
                {RESTAURANT_NAF_CODES.map((n) => (
                  <option key={n.code} value={n.code}>
                    {n.label}
                  </option>
                ))}
              </datalist>
              <datalist id="drinks-licenses">
                {DRINKS_LICENSES.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </fieldset>

            <div className="flex justify-end">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Toaster />
    </>
  );
}
