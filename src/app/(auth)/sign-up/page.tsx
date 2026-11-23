import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { safeNextPath, withNext } from "@/lib/auth/next";
import { searchParam, type SearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const next = safeNextPath(searchParam(params, "next"));

  return (
    <AuthCard
      title="Create an account"
      description="Free, and it keeps your practice in one place. Reading every study material stays open without one."
      footer={
        <p>
          Already have an account?{" "}
          <Link
            href={withNext("/sign-in", next)}
            className="font-medium text-cobalt underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <SignUpForm next={next} />
    </AuthCard>
  );
}
