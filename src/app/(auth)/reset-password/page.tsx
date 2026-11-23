import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { RequestResetForm } from "@/components/auth/request-reset-form";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { searchParam, type SearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const token = searchParam(params, "token").trim();

  // One route, two states: the request form without a token, the new-password form with
  // one (`INFORMATION_ARCHITECTURE.md` §4.2, `EMAIL_AND_NOTIFICATIONS.md` §3).
  if (!token) {
    return (
      <AuthCard
        title="Reset your password"
        description="Enter the email on your account and we will send a reset link."
        footer={
          <p>
            Remembered it?{" "}
            <Link
              href="/sign-in"
              className="font-medium text-cobalt underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        }
      >
        <RequestResetForm />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Setting a new password signs out every other session on your account."
      footer={
        <p>
          The link stopped working?{" "}
          <Link
            href="/reset-password"
            className="font-medium text-cobalt underline-offset-4 hover:underline"
          >
            Request a new one
          </Link>
        </p>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
