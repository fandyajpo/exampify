import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerification } from "@/components/auth/resend-verification";
import { ButtonLink } from "@/components/ui/button";
import { safeNextPath, withNext } from "@/lib/auth/next";
import { auth } from "@/lib/auth/server";
import { searchParam, type SearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Verify your email" };

type VerificationOutcome = "pending" | "verified" | "expired";

async function verify(token: string): Promise<VerificationOutcome> {
  if (!token) return "pending";

  try {
    await auth.api.verifyEmail({ query: { token } });
    return "verified";
  } catch {
    return "expired";
  }
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const token = searchParam(params, "token").trim();
  const email = searchParam(params, "email").trim();
  // Sign-up and the emailed link both carry the sanitized destination, so the sign-in
  // button here returns the visitor to it instead of a bare home page.
  const next = safeNextPath(searchParam(params, "next"));
  const outcome = await verify(token);

  if (outcome === "verified") {
    return (
      <AuthCard
        title="Email verified"
        description="Your address is confirmed. You can sign in and start practising."
        footer="Verification unlocks practice attempts and saved progress."
      >
        <div className="flex flex-col gap-4">
          <ButtonLink href={withNext("/sign-in", next)} size="md" className="w-full">
            Sign in
          </ButtonLink>
          <Link
            href="/subjects"
            className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            Keep browsing subjects
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (outcome === "expired") {
    return (
      <AuthCard
        title="That link has expired"
        description="Verification links work once and last 24 hours. Ask for a fresh one below."
        footer="Reading and browsing stay open without a verified address."
      >
        <div className="flex flex-col gap-5">
          <ResendVerification email={email} next={next} />
          <Link
            href={withNext("/sign-in", next)}
            className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Check your email"
      description={
        email
          ? `We sent a verification link to ${email}.`
          : "Open the verification link we sent to finish setting up your account."
      }
      footer="Verification is needed before your first practice attempt. Reading and browsing stay open."
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-ink-2">
          Open the link in the email to confirm your address. If it has not arrived after a
          minute, look in your spam folder before asking for another one.
        </p>

        <ResendVerification email={email} next={next} />

        <Link
          href="/subjects"
          className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          Keep browsing subjects
        </Link>
      </div>
    </AuthCard>
  );
}
