"use client";

import { useActionState, useState } from "react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { resendVerificationAction } from "@/lib/auth/actions";
import { actionFieldErrors, initialAuthState } from "@/lib/auth/form-state";

type Field = "email";

export function ResendVerification({
  email = "",
  next = null,
}: {
  email?: string;
  next?: string | null;
}): React.JSX.Element {
  const [state, formAction, pending] = useActionState(
    resendVerificationAction,
    initialAuthState,
  );
  const [value, setValue] = useState(email);
  const [changed, setChanged] = useState<readonly Field[]>([]);

  const error = actionFieldErrors<Field>(state, changed).email;

  if (state.status === "success") {
    return <AuthStatusMessage tone="success">{state.message}</AuthStatusMessage>;
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5"
      noValidate
      onSubmit={() => setChanged([])}
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.status === "error" ? (
        <AuthStatusMessage tone="error">{state.message}</AuthStatusMessage>
      ) : null}

      <FormField
        id="email"
        label="Email"
        required
        hint="The address you signed up with."
        error={error ?? null}
      >
        {(control) => (
          <Input
            {...control}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setChanged(["email"]);
            }}
          />
        )}
      </FormField>

      <Button type="submit" variant="secondary" size="md" disabled={pending}>
        {pending ? "Sending…" : "Send a new verification email"}
      </Button>
    </form>
  );
}
