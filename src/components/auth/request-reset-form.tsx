"use client";

import { useActionState, useState } from "react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { actionFieldErrors, initialAuthState } from "@/lib/auth/form-state";
import { resetRequestSchema } from "@/lib/validation/auth";
import { toFieldErrors } from "@/lib/validation/errors";

type Field = "email";

export function RequestResetForm(): React.JSX.Element {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    initialAuthState,
  );
  const [email, setEmail] = useState("");
  const [localErrors, setLocalErrors] = useState<Partial<Record<Field, string>>>({});
  const [changed, setChanged] = useState<readonly Field[]>([]);

  const error = localErrors.email ?? actionFieldErrors<Field>(state, changed).email;

  function validate(value: string) {
    const parsed = resetRequestSchema.shape.email.safeParse(value);
    setLocalErrors(parsed.success ? {} : toFieldErrors<Field>(parsed.error));
  }

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
      {state.status === "error" ? (
        <AuthStatusMessage tone="error">{state.message}</AuthStatusMessage>
      ) : null}

      <FormField
        id="email"
        label="Email"
        required
        hint="Use the address on your account."
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
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setChanged(["email"]);
              setLocalErrors({});
            }}
            onBlur={() => validate(email)}
          />
        )}
      </FormField>

      <Button type="submit" size="md" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
