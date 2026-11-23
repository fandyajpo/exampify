"use client";

import { useActionState, useState } from "react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { resetPasswordAction } from "@/lib/auth/actions";
import { actionFieldErrors, initialAuthState } from "@/lib/auth/form-state";

type Field = "password" | "confirmPassword";

export function ResetPasswordForm({ token }: { token: string }): React.JSX.Element {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialAuthState);
  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  const [changed, setChanged] = useState<readonly Field[]>([]);

  const errors: Partial<Record<Field, string>> = actionFieldErrors<Field>(state, changed);

  function update(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setChanged((current) => (current.includes(field) ? current : [...current, field]));
  }

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <AuthStatusMessage tone="success">{state.message}</AuthStatusMessage>
        <ButtonLink href="/sign-in" size="md" className="w-full">
          Sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5"
      noValidate
      onSubmit={() => setChanged([])}
    >
      <input type="hidden" name="token" value={token} />

      {state.status === "error" ? (
        <AuthStatusMessage tone="error">{state.message}</AuthStatusMessage>
      ) : null}

      <FormField
        id="password"
        label="New password"
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

      <FormField
        id="confirmPassword"
        label="Confirm new password"
        required
        error={errors.confirmPassword ?? null}
      >
        {(control) => (
          <Input
            {...control}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(event) => update("confirmPassword", event.target.value)}
          />
        )}
      </FormField>

      <Button type="submit" size="md" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
