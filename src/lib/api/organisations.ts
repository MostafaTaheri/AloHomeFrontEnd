import { apiRequest } from "./client";
import { asList, asPage, unwrap, type Page } from "./envelope";

/**
 * Organisations (IAM-01): management companies, owners corporations and self-managed groups that
 * hold several schemes. Staff manage them in the back office; owners and admins of an active
 * organisation get manager access to its schemes.
 */

export type OrganisationKindName = "ManagementCompany" | "OwnersCorporation" | "SelfManaged";
export type OrganisationStatusName = "Active" | "Suspended";
export type OrganisationRoleName = "Owner" | "Admin" | "Staff";

export const ORGANISATION_KINDS = { ManagementCompany: 1, OwnersCorporation: 2, SelfManaged: 3 };
export const ORGANISATION_STATUSES = { Active: 1, Suspended: 2 };
export const ORGANISATION_ROLES = { Owner: 1, Admin: 2, Staff: 3 };

export interface OrganisationScheme {
  schemeId: number;
  title: string;
  jurisdictionCode: string;
  currencyCode: string;
}

export interface OrganisationMember {
  id: number;
  userId: string;
  role: OrganisationRoleName | string;
  status: "Active" | "Revoked" | string;
}

export interface Organisation {
  id: number;
  name: string;
  kind: OrganisationKindName | string;
  status: OrganisationStatusName | string;
  countryCode: string;
  registrationNumber: string | null;
  contactEmail: string | null;
  /** Empty in list results; filled on the detail. */
  members: OrganisationMember[];
  schemes: OrganisationScheme[];
}

export interface MyOrganisation {
  organisationId: number;
  name: string;
  role: OrganisationRoleName | string;
  countryCode: string;
  status: OrganisationStatusName | string;
  /** Only for owners and admins of an active organisation. */
  schemes: OrganisationScheme[];
}

export interface OrganisationInput {
  name: string;
  kind: OrganisationKindName;
  registrationNumber?: string;
  contactEmail?: string;
}

export interface CreateOrganisationInput extends OrganisationInput {
  countryCode: "AU" | "IR";
  ownerUserId?: string;
}

type Signal = { signal?: AbortSignal };

const bo = <T>(path: string, options: Parameters<typeof apiRequest>[1] = {}) =>
  apiRequest<T>(`backoffice/${path}`, { ...options, surface: "backoffice" });

const body = (input: OrganisationInput) => ({
  name: input.name,
  kind: ORGANISATION_KINDS[input.kind],
  registrationNumber: input.registrationNumber || undefined,
  contactEmail: input.contactEmail || undefined,
});

export const organisationsApi = {
  mine: async (opts: Signal = {}) =>
    asList<MyOrganisation>(unwrap(await apiRequest("organisations/mine", opts))),
};

export const boOrganisationsApi = {
  list: async (
    params: { countryCode?: string; page?: number; pageSize?: number } = {},
    signal?: AbortSignal,
  ): Promise<Page<Organisation>> =>
    asPage<Organisation>(
      unwrap(
        await bo("organisations", {
          signal,
          query: {
            countryCode: params.countryCode,
            page: params.page ?? 1,
            pageSize: params.pageSize ?? 20,
          },
        }),
      ),
    ),
  get: async (id: number, signal?: AbortSignal) =>
    unwrap<Organisation>(await bo(`organisations/${id}`, { signal })),
  create: async (input: CreateOrganisationInput) =>
    unwrap<Organisation>(
      await bo("organisations", {
        method: "POST",
        body: {
          ...body(input),
          countryCode: input.countryCode,
          ownerUserId: input.ownerUserId || undefined,
        },
      }),
    ),
  update: async (id: number, input: OrganisationInput) =>
    unwrap<Organisation>(await bo(`organisations/${id}`, { method: "PUT", body: body(input) })),
  setStatus: async (id: number, status: OrganisationStatusName) =>
    unwrap<Organisation>(
      await bo(`organisations/${id}/status`, {
        method: "POST",
        body: { status: ORGANISATION_STATUSES[status] },
      }),
    ),
  addMember: async (id: number, input: { userId: string; role: OrganisationRoleName }) =>
    unwrap<OrganisationMember>(
      await bo(`organisations/${id}/members`, {
        method: "POST",
        body: { userId: input.userId, role: ORGANISATION_ROLES[input.role] },
      }),
    ),
  changeMemberRole: async (id: number, userId: string, role: OrganisationRoleName) =>
    unwrap<OrganisationMember>(
      await bo(`organisations/${id}/members/${userId}`, {
        method: "PUT",
        body: { role: ORGANISATION_ROLES[role] },
      }),
    ),
  removeMember: (id: number, userId: string) =>
    bo<null>(`organisations/${id}/members/${userId}`, { method: "DELETE" }),
  attachScheme: async (id: number, schemeId: number) =>
    unwrap<OrganisationScheme>(
      await bo(`organisations/${id}/schemes/${schemeId}`, { method: "POST" }),
    ),
  detachScheme: (id: number, schemeId: number) =>
    bo<null>(`organisations/${id}/schemes/${schemeId}`, { method: "DELETE" }),
};
