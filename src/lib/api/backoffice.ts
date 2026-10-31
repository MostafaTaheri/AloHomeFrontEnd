import { apiRequest } from "./client";
import { asList, asPage, unwrap, type Page } from "./envelope";
import { ActiveStatus, LotRole, SchemeRole } from "./finance/enums";
import type { InsightFeedback, PilotMetrics, SchemeRoleName } from "./finance/types";

/** Back-office calls. They always go through the staff relay (/api/bo/backend). */
const call = <T>(path: string, options: Parameters<typeof apiRequest>[1] = {}) =>
  apiRequest<T>(path, { ...options, surface: "backoffice" });

export interface BoScheme {
  id: number;
  title: string;
  status: string | number;
  address: string;
  latitude: number;
  longitude: number;
  floor: number;
  guestParkingCount: number;
  jurisdictionCode: string;
  currencyCode: string;
  timeZoneId: string;
}

export interface BoLot {
  id: number;
  schemeId?: number;
  status?: string | number;
  lotNumber: string;
  vacateAt: string | null;
  area: number;
  rooms: number;
  floor: number;
  postalCode: string;
  parkingSpots?: { id: number; spotNumber: string }[];
}

export interface BoSchemeDetail extends BoScheme {
  lotSchemeResultItems: BoLot[];
}

export interface SchemeMember {
  id: number;
  schemeId: number;
  userId: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface AccessDeniedLog {
  id: string;
  userId: string;
  schemeId: number;
  resource: string;
  requiredAccess: string;
  occurredAt: string;
}

export interface SeedDemoResult {
  schemeId: number;
  title: string;
  jurisdictionCode: string;
  currency: string;
  lots: number;
  financialRecords: number;
  capitalWorkItems: number;
  fundingScenarios: number;
  expenseFlags: number;
}

export interface SchemeInput {
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  floor: number;
  guestParkingCount: number;
  registrationNumber: string;
  timeZoneId: string;
}

export interface LotInput {
  lotNumber: string;
  area: number;
  rooms: number;
  floor: number;
  postalCode: string;
  entitlement: number;
}

type Status = "Active" | "Disabled";

export const backofficeApi = {
  schemes: async (
    params: { status?: Status; page?: number; pageSize?: number } = {},
    signal?: AbortSignal,
  ): Promise<Page<BoScheme>> =>
    asPage<BoScheme>(
      unwrap(
        await call("backoffice/schemes", {
          signal,
          query: {
            status: params.status ? ActiveStatus.toNumber(params.status) : undefined,
            page: params.page,
            pageSize: params.pageSize,
          },
        }),
      ),
    ),
  scheme: async (id: number, signal?: AbortSignal) =>
    unwrap<BoSchemeDetail>(await call(`backoffice/schemes/${id}`, { signal })),
  createScheme: async (input: SchemeInput & { jurisdictionCode: string; status: Status }) =>
    unwrap<unknown>(
      await call("backoffice/schemes", {
        method: "POST",
        body: {
          ...input,
          status: ActiveStatus.toNumber(input.status),
          registrationNumber: input.registrationNumber || null,
        },
      }),
    ),
  updateScheme: async (id: number, input: SchemeInput) =>
    unwrap<unknown>(
      await call(`backoffice/schemes/${id}`, {
        method: "PUT",
        body: { ...input, registrationNumber: input.registrationNumber || null },
      }),
    ),
  changeSchemeStatus: async (id: number, status: Status) =>
    unwrap<unknown>(
      await call(`backoffice/schemes/${id}/status`, {
        method: "POST",
        body: { schemeStatus: ActiveStatus.toNumber(status) },
      }),
    ),

  lots: async (
    schemeId: number,
    params: { page?: number; pageSize?: number } = {},
    signal?: AbortSignal,
  ) =>
    asPage<BoLot>(
      unwrap(await call(`backoffice/schemes/${schemeId}/lots`, { signal, query: params })),
    ),
  createLot: async (schemeId: number, input: LotInput & { status: Status }) =>
    unwrap<unknown>(
      await call(`backoffice/schemes/${schemeId}/lots`, {
        method: "POST",
        body: { ...input, status: ActiveStatus.toNumber(input.status) },
      }),
    ),
  updateLot: async (schemeId: number, lotId: number, input: LotInput) =>
    unwrap<unknown>(
      await call(`backoffice/schemes/${schemeId}/lots/${lotId}`, { method: "PUT", body: input }),
    ),
  changeLotStatus: async (schemeId: number, lotId: number, status: Status) =>
    unwrap<unknown>(
      await call(`backoffice/schemes/${schemeId}/lots/${lotId}/status`, {
        method: "POST",
        body: { lotStatus: ActiveStatus.toNumber(status) },
      }),
    ),
  vacateLot: async (schemeId: number, lotId: number) =>
    unwrap<unknown>(
      await call(`backoffice/schemes/${schemeId}/lots/${lotId}/vacate`, { method: "POST" }),
    ),
  assignResident: async (
    schemeId: number,
    lotId: number,
    input: { userId: string; role: "Owner" | "FamilyMember" },
  ) =>
    unwrap<unknown>(
      await call(`backoffice/schemes/${schemeId}/lots/${lotId}/residents`, {
        method: "POST",
        body: { userId: input.userId, role: LotRole.toNumber(input.role) },
      }),
    ),
  removeResident: async (schemeId: number, lotId: number, userId: string) =>
    unwrap<unknown>(
      await call(`backoffice/schemes/${schemeId}/lots/${lotId}/residents/${userId}`, {
        method: "DELETE",
      }),
    ),
  changeResidentRole: async (
    schemeId: number,
    lotId: number,
    userId: string,
    role: "Owner" | "FamilyMember",
  ) =>
    unwrap<unknown>(
      await call(`backoffice/schemes/${schemeId}/lots/${lotId}/residents/${userId}/role`, {
        method: "POST",
        body: { newRole: LotRole.toNumber(role) },
      }),
    ),
  moveResident: async (
    schemeId: number,
    lotId: number,
    userId: string,
    input: { toLotId: number; role: "Owner" | "FamilyMember" },
  ) =>
    unwrap<unknown>(
      await call(`backoffice/schemes/${schemeId}/lots/${lotId}/residents/${userId}/move`, {
        method: "POST",
        body: { toLotId: input.toLotId, newRole: LotRole.toNumber(input.role) },
      }),
    ),

  members: async (
    schemeId: number,
    params: { page?: number; pageSize?: number } = {},
    signal?: AbortSignal,
  ) =>
    asPage<SchemeMember>(
      unwrap(await call(`backoffice/schemes/${schemeId}/members`, { signal, query: params })),
    ),
  addMember: async (schemeId: number, input: { userId: string; role: SchemeRoleName }) =>
    unwrap<SchemeMember>(
      await call(`backoffice/schemes/${schemeId}/members`, {
        method: "POST",
        body: { userId: input.userId, role: SchemeRole.toNumber(input.role) },
      }),
    ),
  changeMemberRole: async (schemeId: number, userId: string, role: SchemeRoleName) =>
    unwrap<SchemeMember>(
      await call(`backoffice/schemes/${schemeId}/members/${userId}/role`, {
        method: "PUT",
        body: { role: SchemeRole.toNumber(role) },
      }),
    ),
  removeMember: async (schemeId: number, userId: string) =>
    unwrap<unknown>(
      await call(`backoffice/schemes/${schemeId}/members/${userId}`, { method: "DELETE" }),
    ),
  accessDeniedLogs: async (
    params: { schemeId?: number; userId?: string; page?: number; pageSize?: number } = {},
    signal?: AbortSignal,
  ) =>
    asPage<AccessDeniedLog>(
      unwrap(await call("backoffice/schemes/access-denied-logs", { signal, query: params })),
    ),

  createUser: async (phoneNumber: string) =>
    unwrap<Record<string, unknown> | null>(
      await call("backoffice/users", { method: "POST", body: { phoneNumber } }),
    ),
  activateUser: async (userId: string) =>
    unwrap<unknown>(await call(`backoffice/users/${userId}/activate`, { method: "POST" })),
  deactivateUser: async (userId: string) =>
    unwrap<unknown>(await call(`backoffice/users/${userId}/deactivate`, { method: "POST" })),

  pilotMetrics: async (schemeId: number, signal?: AbortSignal) =>
    unwrap<PilotMetrics>(await call(`backoffice/pilot/schemes/${schemeId}/metrics`, { signal })),
  pilotFeedback: async (
    params: { schemeId?: number; page?: number; pageSize?: number } = {},
    signal?: AbortSignal,
  ) =>
    asPage<InsightFeedback>(
      unwrap(await call("backoffice/pilot/feedback", { signal, query: params })),
    ),
  seedDemo: async (jurisdiction: string) =>
    unwrap<SeedDemoResult>(
      await call("backoffice/demo/seed", { method: "POST", query: { jurisdiction } }),
    ),
  projectInvoices: async (schemeId: number) =>
    unwrap<unknown>(
      await call(`backoffice/schemes/${schemeId}/finance/project-invoices`, { method: "POST" }),
    ),
};

export { asList };
