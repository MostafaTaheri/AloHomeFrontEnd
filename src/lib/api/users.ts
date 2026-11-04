import type { Surface } from "@/lib/bff/surface";
import { apiRequest } from "./client";
import { unwrap } from "./envelope";

/** The signed-in user, as the header shows them. */
export interface MyProfile {
  userId: string;
  phoneNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  /** "First Last", or null when the user has no name yet. */
  fullName: string | null;
}

/** `GET users/me` on either surface; both resolve the caller to the same local user. */
export const meApi = {
  get: async (surface: Surface, signal?: AbortSignal) =>
    unwrap<MyProfile>(await apiRequest("users/me", { surface, signal })),
};
