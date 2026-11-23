import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/server";

/**
 * The library's own routes (`API_CONTRACTS.md` §3): OAuth callbacks, its client SDK and the
 * endpoints `auth.api.*` calls under the hood. The product's forms call server actions, not
 * these paths directly; this mount is what makes a session cookie a real HTTP cookie.
 */
export const { GET, POST } = toNextJsHandler(auth);
