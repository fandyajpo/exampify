"use client";

import { useActionState, useState } from "react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { signInAction } from "@/lib/auth/actions";
import { actionFieldErrors, initialAuthState } from "@/lib/auth/form-state";
import { signInSchema } from "@/lib/validation/auth";

type Field = "email" | "password";

export function SignInForm({ next }: { next: string | null }): React.JSX.Element {
  const [state, formAction, pending] = useActionState(signInAction, initialAuthState);
  const [values, setValues] = useState({ email: "", password: "" });
  const [localErrors, setLocalErrors] = useState<Partial<Record<Field, string>>>({});
  const [changed, setChanged] = useState<readonly Field[]>([]);

  const errors: Partial<Record<Field, string>> = {
    ...actionFieldErrors<Field>(state, changed),
    ...localErrors,
  };

  function update(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setChanged((current) => (current.includes(field) ? current : [...current, field]));
    setLocalErrors((current) => {
      if (!(field in current)) return current;
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  function validate(field: Field, value: string) {
    const result = signInSchema.shape[field].safeParse(value);

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
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.status === "error" ? <AuthStatusMessage tone="error">{state.message}</AuthStatusMessage> : null}

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

      <FormField id="password" label="Password" required error={errors.password ?? null}>
        {(control) => (
          <Input
            {...control}
            name="password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(event) => update("password", event.target.value)}
          />
        )}
      </FormField>

      <Button type="submit" size="md" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
