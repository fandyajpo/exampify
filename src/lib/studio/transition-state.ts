/**
 * What a lifecycle action hands back to the studio, in its own module so a client component
 * can import the type without importing the `"use server"` action module.
 *
 * `details` carries the publish-gate refusals one field at a time — the author needs to see
 * "summary too short" next to the reason they can act on, not a single generic string.
 */

export type TransitionState =
  | { status: "idle" }
  | { status: "error"; message: string; details: { path: string; message: string }[] }
  | { status: "saved"; message: string };

export const initialTransitionState: TransitionState = { status: "idle" };
