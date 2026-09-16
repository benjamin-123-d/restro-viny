"use client"

import { useState } from "react"

import { UtensilsCrossedIcon } from "lucide-react"

import { requestOtpAction, verifyOtpAction } from "@/actions/auth.actions"
import { startLoginAction, verifyPinAction } from "@/actions/pin.actions"
import { PhoneInput } from "@/components/phone-input"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useServerAction } from "@/hooks/use-server-action"
import { cn } from "@/lib/utils"
import { phoneSchema } from "@/lib/validators/shared"

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  OTP_USER_NOT_FOUND:
    "Ce numéro n'est pas enregistré. Demandez à votre administrateur de vous ajouter.",
  PIN_INVALID: "Code PIN incorrect.",
  PIN_LOCKED: "Trop d'essais. Connectez-vous avec un code reçu par SMS.",
}

const toAuthMessage = (raw: string) => AUTH_ERROR_MESSAGES[raw] ?? raw

type Step = "phone" | "pin" | "code"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [pin, setPin] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)

  const start = useServerAction(startLoginAction, {
    onSuccess: (data) => {
      setError(null)
      setStep(data?.method === "pin" ? "pin" : "code")
    },
    onError: (message) => setError(toAuthMessage(message)),
  })

  const sendCode = useServerAction(requestOtpAction, {
    onSuccess: () => {
      setError(null)
      setPin("")
      setStep("code")
    },
    onError: (message) => setError(toAuthMessage(message)),
  })

  const verifyPin = useServerAction(verifyPinAction, {
    redirectTo: "/dashboard",
    onError: (message) => {
      setError(toAuthMessage(message))
      if (message === "PIN_LOCKED") {
        sendCode.execute({ phone })
      }
    },
  })

  const verify = useServerAction(verifyOtpAction, {
    redirectTo: "/dashboard",
    onError: (message) => setError(toAuthMessage(message)),
  })

  const handlePhoneSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = phoneSchema.safeParse(phone)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Saisissez un numéro de téléphone valide")
      return
    }
    setError(null)
    start.execute({ phone })
  }

  const handlePinSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!/^\d{4,6}$/.test(pin)) {
      setError("Saisissez votre code PIN (4 à 6 chiffres)")
      return
    }
    setError(null)
    verifyPin.execute({ phone, pin })
  }

  const handleCodeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setError("Saisissez le code à 6 chiffres")
      return
    }
    setError(null)
    verify.execute({ phone, code })
  }

  const changeNumber = () => {
    setPin("")
    setCode("")
    setError(null)
    setStep("phone")
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <UtensilsCrossedIcon className="size-6" />
        </span>
        <h1 className="text-xl font-bold">Connexion à ElitaleRestro</h1>
        <FieldDescription>
          Run your restaurant&apos;s orders, inventory, and billing in one place.
        </FieldDescription>
      </div>

      {step === "phone" ? (
        <form onSubmit={handlePhoneSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="phone">Numéro de téléphone</FieldLabel>
              <PhoneInput
                id="phone"
                onChange={(value) => {
                  setPhone(value)
                  if (error) {
                    setError(null)
                  }
                }}
                invalid={Boolean(error)}
                disabled={start.isPending}
              />
              <FieldDescription>
                Enter your PIN, or we&apos;ll text you a one-time code.
              </FieldDescription>
              {error ? (
                <FieldDescription className="text-destructive">
                  {error}
                </FieldDescription>
              ) : null}
            </Field>
            <Field>
              <Button type="submit" disabled={start.isPending}>
                {start.isPending ? "Patientez…" : "Continuer"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      ) : null}

      {step === "pin" ? (
        <form onSubmit={handlePinSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="pin">Code PIN</FieldLabel>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                placeholder="••••••"
                value={pin}
                onChange={(event) => {
                  setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                  if (error) {
                    setError(null)
                  }
                }}
                aria-invalid={error ? true : undefined}
                autoFocus
              />
              <FieldDescription>
                Signing in as {phone}.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={changeNumber}
                >
                  Changer de numéro
                </button>
              </FieldDescription>
              {error ? (
                <FieldDescription className="text-destructive">
                  {error}
                </FieldDescription>
              ) : null}
            </Field>
            <Field>
              <Button type="submit" disabled={verifyPin.isPending}>
                {verifyPin.isPending ? "Vérification…" : "Se connecter"}
              </Button>
              <FieldDescription className="text-center">
                Forgot your PIN?{" "}
                <button
                  type="button"
                  className="underline"
                  disabled={sendCode.isPending}
                  onClick={() => sendCode.execute({ phone })}
                >
                  Recevoir plutôt un code par SMS
                </button>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      ) : null}

      {step === "code" ? (
        <form onSubmit={handleCodeSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="code">Code de vérification</FieldLabel>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  if (error) {
                    setError(null)
                  }
                }}
                aria-invalid={error ? true : undefined}
                autoFocus
              />
              <FieldDescription>
                Sent to {phone}.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={changeNumber}
                >
                  Changer de numéro
                </button>
              </FieldDescription>
              {error ? (
                <FieldDescription className="text-destructive">
                  {error}
                </FieldDescription>
              ) : null}
            </Field>
            <Field>
              <Button type="submit" disabled={verify.isPending}>
                {verify.isPending ? "Vérification…" : "Vérifier et continuer"}
              </Button>
              <FieldDescription className="text-center">
                Didn&apos;t get it?{" "}
                <button
                  type="button"
                  className="underline"
                  disabled={sendCode.isPending}
                  onClick={() => sendCode.execute({ phone })}
                >
                  Renvoyer le code
                </button>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      ) : null}

      <FieldDescription className="px-6 text-center">
        En continuant, vous acceptez nos <a href="#">conditions d’utilisation</a> et notre{" "}
        <a href="#">politique de confidentialité</a>.
      </FieldDescription>
    </div>
  )
}
