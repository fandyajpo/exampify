"use client";

import { useActionState, useState } from "react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { signUpAction } from "@/lib/auth/actions";
import { actionFieldErrors, initialAuthState } from "@/lib/auth/form-state";
import { signUpSchema } from "@/lib/validation/auth";

type Field = "name" | "email" | "password" | "ageAttested";

export function SignUpForm({ next }: { next: string | null }): React.JSX.Element {
  const [state, formAction, pending] = useActionState(signUpAction, initialAuthState);
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [ageAttested, setAgeAttested] = useState(false);
  const [localErrors, setLocalErrors] = useState<Partial<Record<Field, string>>>({});
  const [changed, setChanged] = useState<readonly Field[]>([]);

  const errors: Partial<Record<Field, string>> = {
    ...actionFieldErrors<Field>(state, changed),
    ...localErrors,
  };

  function markChanged(field: Field) {
    setChanged((current) => (current.includes(field) ? current : [...current, field]));
  }

  function clear(field: Field) {
    setLocalErrors((current) => {
      if (!(field in current)) return current;
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  function update(field: "name" | "email" | "password", value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    markChanged(field);
    clear(field);
  }

  function validate(field: "name" | "email", value: string) {
    const result = signUpSchema.shape[field].safeParse(value);

    setLocalErrors((current) => {
      const nextErrors = { ...current };
      const message = result.success ? undefined : result.error.issues[0]?.message;
      if (message) nextErrors[field] = message;
      else delete nextErrors[field];
      return nextErrors;
    });
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5"
      noValidate
      onSubmit={() => setChanged([])}
      /* The action never succeeds, so keep what was typed. React resets the form after an
         action, which unchecks the controlled age box without re-rendering it checked. */
      onReset={(event) => event.preventDefault()}
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.status === "error" ? <AuthStatusMessage tone="error">{state.message}</AuthStatusMessage> : null}

      <FormField id="name" label="Name" required error={errors.name ?? null}>
        {(control) => (
          <Input
            {...control}
            name="name"
            autoComplete="name"
            placeholder="Your name"
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            onBlur={() => validate("name", values.name)}
          />
        )}
      </FormField>

      <FormField id="email" label="Email" required error={errors.email ?? null}>
        {(control) => (
          <Input
            {...control}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            onBlur={() => validate("email", values.email)}
          />
        )}
      </FormField>

      <FormField
        id="password"
        label="Password"
        required
        hint="At least 10 characters. No capital or symbol rules."
        error={errors.password ?? null}
      >
        {(control) => (
          <Input
            {...control}
            name="password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(event) => update("password", event.target.value)}
          />
        )}
      </FormField>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3">
          <input
            id="ageAttested"
            name="ageAttested"
            type="checkbox"
            checked={ageAttested}
            onChange={(event) => {
              setAgeAttested(event.target.checked);
              markChanged("ageAttested");
              clear("ageAttested");
            }}
            aria-invalid={errors.ageAttested ? true : undefined}
            aria-describedby={
              errors.ageAttested ? "ageAttested-hint ageAttested-error" : "ageAttested-hint"
            }
            className="mt-0.5 size-4 shrink-0 rounded-sm border border-line-strong accent-cobalt"
          />
          <label htmlFor="ageAttested" className="text-sm text-ink">
            I am 16 or older and accept the Terms and Privacy Notice.
          </label>
        </div>
        <p id="ageAttested-hint" className="pl-7 text-sm text-ink-3">
          We record that you confirmed the age gate, never your date of birth.
        </p>
        {errors.ageAttested ? (
          <p
            id="ageAttested-error"
            className="pl-7 text-sm font-medium text-coral-ink"
            aria-live="polite"
          >
            {errors.ageAttested}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="md" className="w-full" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
