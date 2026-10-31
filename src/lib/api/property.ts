import { apiRequest } from "./client";
import { asList, unwrap } from "./envelope";
import { LotRole } from "./finance/enums";

/**
 * Property history (STR-03..05): effective-dated ownership and occupancy of each lot, and the
 * scheme's office holders. History is append-only; ending a tenure records an end date rather
 * than deleting it.
 */

export type LotRoleName = "Owner" | "FamilyMember" | "Tenant" | "Occupant";
export type SchemeOfficeName =
  | "Chairperson"
  | "Secretary"
  | "Treasurer"
  | "CommitteeMember"
  | "StrataManagingAgent"
  | "BuildingManager"
  | "Auditor";

export const SCHEME_OFFICES: Record<SchemeOfficeName, number> = {
  Chairperson: 1,
  Secretary: 2,
  Treasurer: 3,
  CommitteeMember: 4,
  StrataManagingAgent: 5,
  BuildingManager: 6,
  Auditor: 7,
};

export interface LotTenure {
  id: string;
  lotId: number;
  kind: "Ownership" | "Occupancy" | string;
  role: LotRoleName | string;
  userId: string | null;
  partyName: string | null;
  /** Ownership only. */
  sharePercent: number | null;
  startDate: string;
  endDate: string | null;
  source: "Manual" | "Migrated" | "Transfer" | string;
  reference: string | null;
  endReason: string | null;
}

export interface LotHolders {
  lotId: number;
  lotNumber: string;
  asOf: string;
  owners: LotTenure[];
  occupants: LotTenure[];
  ownedSharePercent: number;
  ownershipComplete: boolean;
}

export interface OfficeHolder {
  id: string;
  office: SchemeOfficeName | string;
  userId: string | null;
  organisationId: number | null;
  externalName: string | null;
  termStart: string;
  termEnd: string | null;
  isCurrent: boolean;
  appointmentReference: string | null;
  endReason: string | null;
}

/** A party is a user account or, for people without one, a name. */
export interface Party {
  userId?: string;
  partyName?: string;
}

export interface NewOwner extends Party {
  sharePercent: number;
}

export interface TransferInput {
  effectiveDate: string;
  owners: NewOwner[];
  reference?: string;
}

export interface OccupancyInput extends Party {
  role: LotRoleName;
  startDate: string;
  endDate?: string;
  reference?: string;
}

export interface AppointInput {
  office: SchemeOfficeName;
  userId?: string;
  organisationId?: number;
  externalName?: string;
  termStart: string;
  termEnd?: string;
  appointmentReference?: string;
}

type Signal = { signal?: AbortSignal };
const scheme = (id: number, path: string) => `schemes/${id}/${path}`;

export const propertyApi = {
  tenures: async (schemeId: number, lotId: number, opts: Signal = {}) =>
    asList<LotTenure>(unwrap(await apiRequest(scheme(schemeId, `lots/${lotId}/tenures`), opts))),
  holders: async (schemeId: number, lotId: number, asOf?: string, opts: Signal = {}) =>
    unwrap<LotHolders>(
      await apiRequest(scheme(schemeId, `lots/${lotId}/holders`), { ...opts, query: { asOf } }),
    ),
  transfer: async (schemeId: number, lotId: number, input: TransferInput) =>
    asList<LotTenure>(
      unwrap(
        await apiRequest(scheme(schemeId, `lots/${lotId}/ownership-transfers`), {
          method: "POST",
          body: input,
        }),
      ),
    ),
  startOccupancy: async (schemeId: number, lotId: number, input: OccupancyInput) =>
    unwrap<LotTenure>(
      await apiRequest(scheme(schemeId, `lots/${lotId}/occupancies`), {
        method: "POST",
        body: { ...input, role: LotRole.toNumber(input.role) },
      }),
    ),
  endTenure: async (schemeId: number, tenureId: string, endDate: string, reason?: string) =>
    unwrap<LotTenure>(
      await apiRequest(scheme(schemeId, `tenures/${tenureId}/end`), {
        method: "POST",
        body: { endDate, reason: reason || undefined },
      }),
    ),
  officeHolders: async (schemeId: number, includeEnded = false, opts: Signal = {}) =>
    asList<OfficeHolder>(
      unwrap(
        await apiRequest(scheme(schemeId, "office-holders"), { ...opts, query: { includeEnded } }),
      ),
    ),
  appoint: async (schemeId: number, input: AppointInput) =>
    unwrap<OfficeHolder>(
      await apiRequest(scheme(schemeId, "office-holders"), {
        method: "POST",
        body: { ...input, office: SCHEME_OFFICES[input.office] },
      }),
    ),
  endTerm: async (schemeId: number, officeHolderId: string, termEnd: string, reason?: string) =>
    unwrap<OfficeHolder>(
      await apiRequest(scheme(schemeId, `office-holders/${officeHolderId}/end`), {
        method: "POST",
        body: { termEnd, reason: reason || undefined },
      }),
    ),
};
