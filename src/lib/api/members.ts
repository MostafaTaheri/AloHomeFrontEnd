import { apiRequest } from "./client";
import { asList, asPage, unwrap, type Page } from "./envelope";
import { SchemeRole } from "./finance/enums";
import type { SchemeRoleName } from "./finance/types";
import type { Surface } from "@/lib/bff/surface";

/**
 * Members of a scheme (building). The back office and the building panel read and write the same
 * memberships through two API surfaces, so a member added on one shows on the other.
 */
export interface SchemeMember {
  id: number;
  schemeId: number;
  userId: string;
  role: SchemeRoleName | string;
  status: "Active" | "Revoked" | string;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phoneNumber: string | null;
  userStatus: string | null;
}

/** An active member, for "pick a member of this building" dropdowns. */
export interface MemberOption {
  userId: string;
  displayName: string;
  phoneNumber: string | null;
  role: SchemeRoleName | string;
}

export interface MemberListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: SchemeRoleName;
  includeRevoked?: boolean;
}

export interface AddMemberInput {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: SchemeRoleName;
}

export interface UpdateMemberInput {
  role: SchemeRoleName;
  firstName?: string;
  lastName?: string;
}

export interface MembersApi {
  list: (
    schemeId: number,
    params?: MemberListParams,
    signal?: AbortSignal,
  ) => Promise<Page<SchemeMember>>;
  options: (schemeId: number, signal?: AbortSignal) => Promise<MemberOption[]>;
  add: (schemeId: number, input: AddMemberInput) => Promise<SchemeMember>;
  update: (schemeId: number, userId: string, input: UpdateMemberInput) => Promise<SchemeMember>;
  remove: (schemeId: number, userId: string) => Promise<unknown>;
}

function membersApiFor(surface: Surface, prefix: string): MembersApi {
  const path = (schemeId: number, rest = "") => `${prefix}schemes/${schemeId}/members${rest}`;
  const call = <T>(p: string, options: Parameters<typeof apiRequest>[1] = {}) =>
    apiRequest<T>(p, { ...options, surface });

  return {
    list: async (schemeId, params = {}, signal) =>
      asPage<SchemeMember>(
        unwrap(
          await call(path(schemeId), {
            signal,
            query: {
              page: params.page,
              pageSize: params.pageSize,
              search: params.search?.trim() || undefined,
              role: params.role ? SchemeRole.toNumber(params.role) : undefined,
              includeRevoked: params.includeRevoked || undefined,
            },
          }),
        ),
      ),
    options: async (schemeId, signal) =>
      asList<MemberOption>(unwrap(await call(path(schemeId, "/options"), { signal }))),
    add: async (schemeId, input) =>
      unwrap<SchemeMember>(
        await call(path(schemeId), {
          method: "POST",
          body: { ...input, role: SchemeRole.toNumber(input.role) },
        }),
      ),
    update: async (schemeId, userId, input) =>
      unwrap<SchemeMember>(
        await call(path(schemeId, `/${userId}`), {
          method: "PUT",
          body: { ...input, role: SchemeRole.toNumber(input.role) },
        }),
      ),
    remove: async (schemeId, userId) =>
      unwrap<unknown>(await call(path(schemeId, `/${userId}`), { method: "DELETE" })),
  };
}

export const boMembersApi = membersApiFor("backoffice", "backoffice/");
export const schemeMembersApi = membersApiFor("client", "");

/** Picker value meaning "not one of the members; record a name instead". */
export const NOT_A_MEMBER = "__not-a-member__";

/** How a member is shown in tables and dropdowns. */
export function memberLabel(member: {
  fullName?: string | null;
  displayName?: string | null;
  phoneNumber?: string | null;
  userId: string;
}): string {
  return member.fullName || member.displayName || member.phoneNumber || member.userId.slice(0, 8);
}
