import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeNextPath, withNext } from "@/lib/auth/next";
import { searchParam, type SearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const next = safeNextPath(searchParam(params, "next"));

  return (
    <AuthCard
      title="Sign in"
      description="Your practice history, saved attempts and progress are waiting."
      footer={
        <p>
          New to Exampify?{" "}
          <Link
            href={withNext("/sign-up", next)}
            className="font-medium text-cobalt underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <SignInForm next={next} />

      <p className="mt-4 text-sm">
        <Link
          href="/reset-password"
          className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          Forgotten your password?
        </Link>
      </p>
    </AuthCard>
  );
}
