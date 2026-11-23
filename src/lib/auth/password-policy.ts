/**
 * The password policy (`SECURITY_AND_PERMISSIONS.md` §4.2) as one pure function, so the
 * form schema and the Better Auth instance's own request hook cannot drift apart.
 *
 * Length and the common-password blocklist need only the password; the email local-part
 * rule needs both, and is skipped when no address is supplied (the reset endpoints set a
 * password without one in the body).
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * The start of the common-password blocklist (`SEC §4.2` asks for the top 10k). The full
 * list does not belong in a client bundle; this covers the passwords a student is most
 * likely to reach for and is the place the real list is swapped in before launch.
 */
const COMMON_PASSWORDS = new Set([
  "1234567890",
  "12345678910",
  "password12",
  "password123",
  "password1234",
  "passwordpassword",
  "qwertyuiop",
  "qwerty1234",
  "iloveyou12",
  "letmein123",
  "welcome123",
  "admin12345",
  "football12",
  "basketball",
  "sunshine12",
  "princess12",
  "superman12",
  "trustno1234",
  "baseball12",
  "dragon1234",
  "monkey1234",
  "shadow1234",
  "master1234",
  "computer12",
  "internet12",
  "starwars12",
  "whatever12",
  "changeme12",
  "exampify12",
]);

/** Rejects a password that repeats the email local part (`SEC §4.2`). */
function sameAsEmailLocalPart(password: string, email: string): boolean {
  const localPart = email.split("@")[0] ?? "";
  return localPart.length >= 4 && password.toLowerCase() === localPart.toLowerCase();
}

/** The first policy message for a password, or `null` when it passes every rule. */
export function passwordPolicyError(password: string, email = ""): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Use ${PASSWORD_MAX_LENGTH} characters or fewer`;
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "That password is too common. Choose something less predictable";
  }

  if (email && sameAsEmailLocalPart(password, email)) {
    return "Choose a password that is not your email address";
  }

  return null;
}
