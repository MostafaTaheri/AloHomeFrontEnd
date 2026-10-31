// Routes the backend added after the MVP: governance, organisations, audit, property history,
// record versions, budgets, the committee pack, reminder batches, capital funding sources and
// contribution impact, AI document extraction and questions, the portfolio, onboarding, and the
// back-office funding-readiness tools.
//
// server.mjs owns the HTTP plumbing and the MVP state; it passes its helpers in through
// createExtended(). Business errors use the backend's numeric codes (App_AloHome_<code>) so the
// UI's error handling can be exercised.
import { randomUUID } from "node:crypto";

export function createExtended(deps) {
  const {
    schemes,
    readJson,
    readRaw,
    parseMultipart,
    pageOf,
    nowUtc,
    addDays,
    daysBetween,
    sum,
    roleOf,
    can,
    lotBalance,
    financialHealth,
    freshness,
    projection,
    createScheme,
    accessDenied,
    MANAGER_ID,
    TREASURER_ID,
    COMMITTEE_ID,
  } = deps;

  // Every handler returns true once it has answered; undefined means "not mine".
  const ok = (res, data) => (deps.ok(res, data), true);
  const fail = (...args) => (deps.fail(...args), true);
  const notFound = (res, what) => (deps.notFound(res, what), true);
  const forbidden = (res) => (deps.forbidden(res), true);
  const noContent = (res) => (res.writeHead(204), res.end(), true);
  const created = (res, data) => ok(res, data);
  const bad = (res, code, message) =>
    fail(res, 400, `App_AloHome_${code}`, "Application Error", [message]);
  const missing = (res, entity, message) =>
    fail(res, 404, `App_${entity}_404`, "Not found Error", [message]);

  const round = (s, n) => (s.market.minor ? Math.round(n * 100) / 100 : Math.round(n));
  const fundLabel = (s, fund) => s.market.fundLabels[fund === "CapitalWorks" ? 1 : 0];
  const FUNDS = { 1: "Admin", 2: "CapitalWorks" };

  // ---------------------------------------------------------------- governance (GOV-01..04)

  const DECIDED_ON = "2026-10-03";
  const FEATURE_ROWS = [
    ["scheme-structure", "Scheme structure", 1, "core", ["IAM-02", "STR-01", "STR-02"]],
    ["financial-records", "Financial records", 1, "core", ["FIN-01", "FIN-05", "FIN-08"]],
    ["imports", "Imports", 1, "onboarding", ["IMP-01", "IMP-09"]],
    ["expense-intelligence", "Expense intelligence", 1, "insight", ["EXP-01", "EXP-09"]],
    ["arrears-intelligence", "Arrears intelligence", 1, "insight", ["ARR-01", "ARR-08"]],
    ["budgets", "Budgets", 1, "insight", ["BUD-01", "BUD-05"]],
    ["capital-works", "Capital works", 1, "planning", ["CAP-01", "CAP-08"]],
    ["controlled-ai", "Controlled AI", 1, "assist", ["AI-01", "AI-08"]],
    ["pilot-evidence", "Pilot evidence", 1, "pilot", ["GTM-01", "GTM-03"]],
    ["security-audit", "Security and audit", 1, "trust", ["SEC-01", "SEC-02"]],
    ["wallets", "Resident wallets", 2],
    ["payments", "Payment processing", 2],
    ["parking", "Parking management", 2],
    ["events", "Community events", 2],
    ["mobile-app", "Native mobile app", 2],
    ["visitor-management", "Visitor management", 3],
    ["access-control", "Access control hardware", 3],
    ["direct-integrations", "Direct accounting integrations", 3],
    ["generic-ai-chat", "General-purpose AI chat", 4],
  ];
  const REASONS = {
    1: "In the product wedge.",
    2: "Frozen until the financial wedge proves value.",
    3: "Deferred to after the pilot.",
    4: "Rejected: unconstrained answers cannot be traced to records.",
  };
  const features = FEATURE_ROWS.map(([key, name, status, wedge, stories]) => ({
    key,
    name,
    status,
    reason: REASONS[status],
    wedge: status === 1 ? wedge : "none",
    stories: status === 1 ? stories : [],
    decidedOn: DECIDED_ON,
  }));
  const pilotScope = {
    minimumLots: 5,
    maximumLots: 50,
    jurisdictions: ["AU-NSW", "IR"],
    modules: [
      "expense-intelligence",
      "arrears-intelligence",
      "capital-works",
      "controlled-ai",
      "budgets",
    ],
    dataRules: [
      "Use anonymised or synthetic data in demos.",
      "No resident contact details in exports.",
      "Every figure traces to a verified record.",
    ],
    successCriteria: [
      "First verified dashboard within two days of onboarding.",
      "At least one confirmed anomaly per scheme.",
      "Managers rate insights useful more often than not.",
    ],
    exitConditions: ["Data cannot be verified.", "The scheme withdraws consent."],
  };
  const governance = {
    version: "2026.10.1",
    checksum: "9C1E5B0F2D4A7E3B8C6D1A0F5E4B3C2D1A0F9E8D7C6B5A4F3E2D1C0B9A8F7E6D",
    narrative: {
      version: "2026.10.1",
      statement:
        "AloHome helps strata committees and building managers understand where their money goes, who is behind, and whether the capital works fund will cope.",
      statementFa:
        "آلوهوم به هیئت‌مدیره و مدیران ساختمان کمک می‌کند بفهمند پول کجا می‌رود، چه کسی بدهکار است و آیا صندوق عمرانی کافی است.",
      questions: [
        "Where did our money go this year?",
        "Which lots are behind, and by how much?",
        "Will the capital works fund cover the plan?",
      ],
      boundaries: [
        "AloHome is not an accounting system of record.",
        "AloHome does not give financial or legal advice.",
      ],
    },
    features,
    pilot: pilotScope,
  };
  const DICTIONARY = [
    ["scheme", "Scheme", "Strata scheme", "ساختمان"],
    ["lot", "Lot", "Lot", "واحد"],
    ["entitlement", "Unit entitlement", "Unit entitlement", "سهم مالکیت"],
    ["owners-body", "Owners body", "Owners corporation", "مجمع مالکان"],
    ["committee", "Committee", "Strata committee", "هیئت مدیره"],
    ["manager", "Manager", "Strata managing agent", "مدیر ساختمان"],
    ["levy", "Levy", "Levy", "شارژ"],
    ["special-levy", "Special levy", "Special levy", "شارژ ویژه"],
    ["admin-fund", "Administrative fund", "Administrative fund", "صندوق جاری"],
    ["capital-fund", "Capital works fund", "Capital works fund", "صندوق عمرانی"],
    ["capital-plan", "Capital plan", "10-year capital works plan", "برنامه عمرانی"],
    ["arrears", "Arrears", "Levy arrears", "بدهی معوق"],
    ["financial-year", "Financial year", "Financial year (1 July)", "سال مالی (۱ فروردین)"],
    ["budget", "Budget", "Annual budget", "بودجه سالانه"],
    ["general-meeting", "General meeting", "Annual general meeting", "مجمع عمومی"],
    ["supplier", "Supplier", "Supplier", "پیمانکار"],
    ["owner", "Owner", "Lot owner", "مالک"],
    ["tenant", "Tenant", "Tenant", "مستأجر"],
  ];

  async function productRoutes(req, res, path, q, lang) {
    if (req.method !== "GET") return notFound(res, "Endpoint");
    if (path === "product/governance") return ok(res, governance);
    if (path === "product/pilot-scope") return ok(res, pilotScope);
    if (path === "product/data-dictionary") {
      const jurisdiction = (q.get("jurisdiction") || "AU-NSW").toUpperCase();
      if (!["AU-NSW", "IR"].includes(jurisdiction))
        return fail(res, 400, "300001", "Domain Error", ["This jurisdiction is not supported."]);
      const fa = jurisdiction === "IR" && lang === "fa";
      return ok(res, {
        version: governance.version,
        jurisdictionCode: jurisdiction,
        language: fa ? "fa" : "en",
        terms: DICTIONARY.map(([key, canonical, au, ir]) => ({
          key,
          canonical,
          local: jurisdiction === "IR" ? ir : au,
          definition: fa
            ? `معادل «${canonical}» در مدل داده آلوهوم.`
            : `The ${canonical.toLowerCase()} as AloHome models it for ${jurisdiction}.`,
          modelReference: canonical.replace(/\s+/g, ""),
        })),
      });
    }
    const feature = /^product\/features\/([A-Za-z0-9-]+)$/.exec(path);
    if (feature) {
      const found = features.find((f) => f.key.toLowerCase() === feature[1].toLowerCase());
      return found ? ok(res, found) : bad(res, 390002, "This feature is not in the catalogue.");
    }
    return notFound(res, "Endpoint");
  }

  // ---------------------------------------------------------------- audit (SEC-02)

  const auditLog = [];
  function audit(entry) {
    auditLog.push({
      id: randomUUID(),
      schemeId: entry.schemeId ?? null,
      organisationId: entry.organisationId ?? null,
      actorId: entry.actorId ?? MANAGER_ID,
      category: entry.category,
      action: entry.action,
      entityType: entry.entityType,
      entityId: String(entry.entityId),
      before: entry.before ? JSON.stringify(entry.before) : null,
      after: entry.after ? JSON.stringify(entry.after) : null,
      reason: entry.reason ?? null,
      correlationId: randomUUID().replace(/-/g, "").slice(0, 16),
      occurredAtUtc: entry.at ?? nowUtc(),
    });
  }

  const AUDIT_CATEGORIES = [
    "Access",
    "Membership",
    "Organisation",
    "Financial",
    "Configuration",
    "Approval",
    "Export",
    "Ai",
    "Property",
  ];
  function filterAudit(res, q, base) {
    const raw = q.get("category");
    let category;
    if (raw) {
      category = /^\d+$/.test(raw) ? AUDIT_CATEGORIES[Number(raw) - 1] : raw;
      if (!AUDIT_CATEGORIES.includes(category))
        return bad(res, 410001, "The audit filter is not valid.");
    }
    const from = q.get("fromUtc");
    const to = q.get("toUtc");
    if (from && to && from > to) return bad(res, 410001, "The start must be before the end.");
    const size = Math.min(200, Math.max(1, Number(q.get("pageSize") ?? 50)));
    q.set("pageSize", String(size));
    const list = base
      .filter((e) => !category || e.category === category)
      .filter((e) => !from || e.occurredAtUtc >= from)
      .filter((e) => !to || e.occurredAtUtc <= to)
      .sort((a, b) => b.occurredAtUtc.localeCompare(a.occurredAtUtc));
    return ok(res, pageOf(list, q));
  }

  // ---------------------------------------------------------------- organisations (IAM-01)

  const KINDS = { 1: "ManagementCompany", 2: "OwnersCorporation", 3: "SelfManaged" };
  const ORG_ROLES = { 1: "Owner", 2: "Admin", 3: "Staff" };
  const organisations = [];
  let nextOrgId = 1;
  let nextOrgMemberId = 1;

  function addOrganisation({ name, kind, countryCode, registrationNumber, contactEmail, owner }) {
    const org = {
      id: nextOrgId++,
      name,
      kind,
      status: "Active",
      countryCode,
      registrationNumber: registrationNumber ?? null,
      contactEmail: contactEmail ?? null,
      members: [],
      schemeIds: [],
    };
    if (owner)
      org.members.push({ id: nextOrgMemberId++, userId: owner, role: "Owner", status: "Active" });
    organisations.push(org);
    return org;
  }
  const orgScheme = (s) => ({
    schemeId: s.id,
    title: s.title,
    jurisdictionCode: s.jurisdictionCode,
    currencyCode: s.market.currency,
  });
  const orgResult = (org, detail = true) => ({
    id: org.id,
    name: org.name,
    kind: org.kind,
    status: org.status,
    countryCode: org.countryCode,
    registrationNumber: org.registrationNumber,
    contactEmail: org.contactEmail,
    members: detail ? org.members.map((m) => ({ ...m })) : [],
    schemes: detail
      ? org.schemeIds
          .map((id) => schemes.get(id))
          .filter(Boolean)
          .map(orgScheme)
      : [],
  });

  function attach(org, s) {
    if (!org.schemeIds.includes(s.id)) org.schemeIds.push(s.id);
    s.organisationId = org.id;
  }

  // Seeds: one company per market, each holding the seeded scheme.
  {
    const au = addOrganisation({
      name: "Harbour Strata Partners",
      kind: "ManagementCompany",
      countryCode: "AU",
      registrationNumber: "ABN 00 000 000 000",
      contactEmail: "office@example.com",
      owner: MANAGER_ID,
    });
    const ir = addOrganisation({
      name: "شرکت مدیریت ساختمان نمونه",
      kind: "SelfManaged",
      countryCode: "IR",
      owner: MANAGER_ID,
    });
    for (const s of schemes.values()) attach(s.market.countryCode === "AU" ? au : ir, s);
    audit({
      organisationId: au.id,
      category: "Organisation",
      action: "organisation.created",
      entityType: "Organisation",
      entityId: au.id,
      after: { Name: au.name, Status: "Active" },
      at: "2026-07-01T08:00:00Z",
    });
  }

  async function boOrganisationRoutes(req, res, path, q, user) {
    const m = req.method;
    let match;
    if (path === "backoffice/organisations" && m === "GET") {
      const country = (q.get("countryCode") || "").toUpperCase();
      const list = organisations.filter((o) => !country || o.countryCode === country);
      const size = Math.min(100, Math.max(1, Number(q.get("pageSize") ?? 20)));
      q.set("pageSize", String(size));
      return ok(
        res,
        pageOf(
          list.map((o) => orgResult(o, false)),
          q,
        ),
      );
    }
    if (path === "backoffice/organisations" && m === "POST") {
      const body = await readJson(req);
      if (!String(body.name ?? "").trim()) return bad(res, 400002, "A name is required.");
      const kind = KINDS[Number(body.kind)];
      if (!kind) return bad(res, 400010, "Choose an organisation type.");
      const country = String(body.countryCode ?? "").toUpperCase();
      if (!["AU", "IR"].includes(country))
        return fail(res, 400, "300001", "Domain Error", ["This country is not supported."]);
      if (
        body.registrationNumber &&
        organisations.some(
          (o) => o.countryCode === country && o.registrationNumber === body.registrationNumber,
        )
      )
        return bad(res, 400003, "An organisation with this registration number already exists.");
      const org = addOrganisation({
        name: body.name.trim(),
        kind,
        countryCode: country,
        registrationNumber: body.registrationNumber,
        contactEmail: body.contactEmail,
        owner: body.ownerUserId,
      });
      audit({
        organisationId: org.id,
        actorId: user,
        category: "Organisation",
        action: "organisation.created",
        entityType: "Organisation",
        entityId: org.id,
        after: { Name: org.name, Kind: org.kind, Status: org.status },
      });
      return created(res, orgResult(org));
    }
    if ((match = /^backoffice\/organisations\/(\d+)(\/.*)?$/.exec(path))) {
      const org = organisations.find((o) => o.id === Number(match[1]));
      if (!org) return missing(res, "Organisation", "Organisation not found.");
      const sub = match[2] ?? "";
      if (!sub && m === "GET") return ok(res, orgResult(org));
      if (!sub && m === "PUT") {
        const body = await readJson(req);
        if (!String(body.name ?? "").trim()) return bad(res, 400002, "A name is required.");
        const before = { Name: org.name, Kind: org.kind };
        org.name = body.name.trim();
        org.kind = KINDS[Number(body.kind)] ?? org.kind;
        org.registrationNumber = body.registrationNumber ?? null;
        org.contactEmail = body.contactEmail ?? null;
        audit({
          organisationId: org.id,
          actorId: user,
          category: "Organisation",
          action: "organisation.updated",
          entityType: "Organisation",
          entityId: org.id,
          before,
          after: { Name: org.name, Kind: org.kind },
        });
        return ok(res, orgResult(org));
      }
      if (sub === "/status" && m === "POST") {
        const body = await readJson(req);
        const status = { 1: "Active", 2: "Suspended" }[Number(body.status)];
        if (!status) return bad(res, 400010, "Choose a valid status.");
        const before = org.status;
        org.status = status;
        audit({
          organisationId: org.id,
          actorId: user,
          category: "Organisation",
          action: "organisation.status-changed",
          entityType: "Organisation",
          entityId: org.id,
          before: { Status: before },
          after: { Status: status },
        });
        return ok(res, orgResult(org));
      }
      if (sub === "/members" && m === "POST") {
        const body = await readJson(req);
        const role = ORG_ROLES[Number(body.role)];
        if (!role) return bad(res, 400006, "Choose a valid role.");
        const existing = org.members.find((x) => x.userId === body.userId);
        if (existing?.status === "Active")
          return bad(res, 400004, "This person is already a member.");
        const member = existing ?? { id: nextOrgMemberId++, userId: body.userId };
        Object.assign(member, { role, status: "Active" });
        if (!existing) org.members.push(member);
        audit({
          organisationId: org.id,
          actorId: user,
          category: "Membership",
          action: "organisation-member.added",
          entityType: "OrganisationMembership",
          entityId: member.id,
          after: { UserId: member.userId, Role: role },
        });
        return created(res, { ...member });
      }
      const memberMatch = /^\/members\/([0-9a-f-]{36})$/i.exec(sub);
      if (memberMatch) {
        const member = org.members.find(
          (x) => x.userId.toLowerCase() === memberMatch[1].toLowerCase() && x.status === "Active",
        );
        if (!member) return missing(res, "OrganisationMembership", "Membership not found.");
        const owners = org.members.filter((x) => x.role === "Owner" && x.status === "Active");
        const lastOwner = member.role === "Owner" && owners.length === 1;
        if (m === "PUT") {
          const body = await readJson(req);
          const role = ORG_ROLES[Number(body.role)];
          if (!role) return bad(res, 400006, "Choose a valid role.");
          if (lastOwner && role !== "Owner")
            return bad(res, 400009, "An organisation must keep at least one owner.");
          const before = member.role;
          member.role = role;
          audit({
            organisationId: org.id,
            actorId: user,
            category: "Membership",
            action: "organisation-member.role-changed",
            entityType: "OrganisationMembership",
            entityId: member.id,
            before: { Role: before },
            after: { Role: role },
          });
          return ok(res, { ...member });
        }
        if (m === "DELETE") {
          if (lastOwner) return bad(res, 400009, "An organisation must keep at least one owner.");
          member.status = "Revoked";
          audit({
            organisationId: org.id,
            actorId: user,
            category: "Membership",
            action: "organisation-member.removed",
            entityType: "OrganisationMembership",
            entityId: member.id,
            before: { Status: "Active" },
            after: { Status: "Revoked" },
          });
          return noContent(res);
        }
      }
      const schemeMatch = /^\/schemes\/(\d+)$/.exec(sub);
      if (schemeMatch) {
        const s = schemes.get(Number(schemeMatch[1]));
        if (!s) return missing(res, "Scheme", "Scheme not found.");
        if (m === "POST") {
          if (s.market.countryCode !== org.countryCode)
            return bad(res, 400007, "The scheme is in a different country from the organisation.");
          for (const other of organisations)
            other.schemeIds = other.schemeIds.filter((id) => id !== s.id);
          attach(org, s);
          audit({
            schemeId: s.id,
            organisationId: org.id,
            actorId: user,
            category: "Organisation",
            action: "organisation.scheme-attached",
            entityType: "Scheme",
            entityId: s.id,
          });
          return ok(res, orgScheme(s));
        }
        if (m === "DELETE") {
          if (!org.schemeIds.includes(s.id))
            return missing(res, "Scheme", "This scheme is not attached to the organisation.");
          org.schemeIds = org.schemeIds.filter((id) => id !== s.id);
          s.organisationId = null;
          audit({
            schemeId: s.id,
            organisationId: org.id,
            actorId: user,
            category: "Organisation",
            action: "organisation.scheme-detached",
            entityType: "Scheme",
            entityId: s.id,
          });
          return noContent(res);
        }
      }
    }
    return undefined;
  }

  // ---------------------------------------------------------------- per-scheme state

  const state = new WeakMap();
  const PARTY_NAMES = ["J. Citizen", "A. Nguyen", "M. Rossi", "S. Patel", "L. Chen", "R. Okafor"];
  const PARTY_NAMES_FA = ["ع. محمدی", "ز. رضایی", "م. کریمی", "ح. احمدی", "ن. حسینی", "ف. موسوی"];

  function ext(s) {
    let x = state.get(s);
    if (x) return x;
    x = {
      tenures: [],
      officeHolders: [],
      versions: new Map(),
      budgets: [],
      reminders: [],
      extractions: [],
      fundingSources: new Map(),
    };
    state.set(s, x);
    seedScheme(s, x);
    return x;
  }

  function tenure(fields) {
    return {
      id: randomUUID(),
      kind: "Ownership",
      role: "Owner",
      userId: null,
      partyName: null,
      sharePercent: null,
      startDate: "2019-07-01",
      endDate: null,
      source: "Migrated",
      reference: null,
      endReason: null,
      ...fields,
    };
  }

  function seedScheme(s, x) {
    const names = s.market.language === "fa" ? PARTY_NAMES_FA : PARTY_NAMES;
    s.lots.forEach((lot, i) => {
      const userId = i === 0 ? MANAGER_ID : i % 2 === 0 ? randomUUID() : null;
      if (i === 1) {
        x.tenures.push(
          tenure({
            lotId: lot.id,
            partyName: names[1],
            sharePercent: 100,
            endDate: "2025-02-27",
            endReason: "ownership transferred",
          }),
          tenure({
            lotId: lot.id,
            partyName: names[2],
            sharePercent: 50,
            startDate: "2025-02-28",
            source: "Transfer",
            reference: "Transfer AB123456",
          }),
          tenure({
            lotId: lot.id,
            partyName: names[3],
            sharePercent: 50,
            startDate: "2025-02-28",
            source: "Transfer",
            reference: "Transfer AB123456",
          }),
        );
      } else {
        x.tenures.push(
          tenure({
            lotId: lot.id,
            userId,
            partyName: userId ? null : names[i % names.length],
            sharePercent: 100,
          }),
        );
      }
      if (i === 2)
        x.tenures.push(
          tenure({
            lotId: lot.id,
            kind: "Occupancy",
            role: "Tenant",
            partyName: names[4],
            startDate: "2025-08-01",
            endDate: "2026-07-31",
            source: "Manual",
            reference: "Lease 2025",
          }),
        );
    });

    const offices =
      s.market.countryCode === "AU"
        ? [
            ["Chairperson", { externalName: names[0] }],
            ["Treasurer", { userId: TREASURER_ID }],
            ["Secretary", { externalName: names[5] }],
            ["CommitteeMember", { userId: COMMITTEE_ID }],
            ["StrataManagingAgent", { organisationId: s.organisationId ?? 1 }],
          ]
        : [
            ["Chairperson", { externalName: names[0] }],
            ["Treasurer", { userId: TREASURER_ID }],
            ["BuildingManager", { userId: MANAGER_ID }],
          ];
    for (const [office, who] of offices) {
      x.officeHolders.push({
        id: randomUUID(),
        office,
        userId: null,
        organisationId: null,
        externalName: null,
        ...who,
        termStart: "2025-11-20",
        termEnd: null,
        appointmentReference: "AGM 2025",
        endReason: null,
      });
    }
    x.officeHolders.push({
      id: randomUUID(),
      office: "Chairperson",
      userId: null,
      organisationId: null,
      externalName: names[3],
      termStart: "2024-11-15",
      termEnd: "2025-11-19",
      appointmentReference: "AGM 2024",
      endReason: "term ended",
    });

    // A corrected expense, so record history has something to show.
    const corrected = s.records.find((r) => r.recordType === "Expense" && r.categoryId);
    if (corrected) {
      const original = { ...corrected, amount: round(s, corrected.amount * 1.1) };
      x.versions.set(corrected.id, [
        version(original, 1, "Created", null, [], "2026-07-05T01:00:00Z"),
        version(
          corrected,
          2,
          "Corrected",
          "Invoice total re-keyed from the supplier's PDF.",
          ["Amount"],
          "2026-07-08T03:30:00Z",
        ),
      ]);
    }

    seedBudgets(s, x);

    // A little history, so the scheme's audit log is not empty on first visit.
    const seeded = [
      [
        "Membership",
        "scheme-member.added",
        "SchemeMembership",
        2,
        null,
        { Role: "Treasurer" },
        "2026-07-01T09:05:00Z",
      ],
      [
        "Property",
        "lot.ownership-transferred",
        "Lot",
        s.lots[1]?.id ?? 0,
        null,
        { Owners: 2 },
        "2026-07-02T04:00:00Z",
      ],
      [
        "Financial",
        "financial-record.corrected",
        "FinancialRecord",
        corrected?.id ?? "",
        { Amount: corrected ? round(s, corrected.amount * 1.1) : 0 },
        { Amount: corrected?.amount ?? 0 },
        "2026-07-08T03:30:00Z",
      ],
      [
        "Approval",
        "budget.approved",
        "Budget",
        x.budgets.find((b) => b.status === "Approved")?.id ?? "",
        { Status: "Draft" },
        { Status: "Approved" },
        "2026-06-20T08:00:00Z",
      ],
      [
        "Configuration",
        "arrears-settings.changed",
        "Scheme",
        s.id,
        { BucketBoundaries: [30, 60] },
        { BucketBoundaries: [30, 60, 90] },
        "2026-07-03T00:00:00Z",
      ],
    ];
    for (const [category, action, entityType, entityId, before, after, at] of seeded)
      audit({ schemeId: s.id, category, action, entityType, entityId, before, after, at });

    // A draft reminder batch written by the treasurer, waiting for someone else to approve.
    const batch = draftReminders(s, x, {
      minimumOverdue: 0,
      minimumDaysOverdue: 30,
      includePaymentPlans: false,
      note: null,
      createdBy: TREASURER_ID,
      lang: s.market.language,
    });
    if (batch) x.reminders.push(batch);

    x.extractions.push(
      extraction(s, {
        fileName: "invoice-fixit-0925.pdf",
        createdAt: "2026-09-26T02:00:00Z",
        supplierIndex: 4,
        amount: round(s, 1840 * s.market.scale),
        date: addDays(s.asOf, -5),
      }),
    );
  }

  // ---------------------------------------------------------------- record versions (FIN-08)

  const snapshot = (r) => ({
    recordType: r.recordType,
    fund: r.fund,
    status: r.status,
    direction: r.direction === "Outflow" ? "Decrease" : "Increase",
    amount: r.amount,
    currency: r.currency,
    transactionDate: r.transactionDate,
    dueDate: r.dueDate,
    financialPeriodId: r.financialPeriodId,
    lotId: r.lotId,
    supplierId: r.supplierId,
    categoryId: r.categoryId,
    externalReference: r.externalReference,
    description: r.description,
    sourceDocumentId: r.sourceDocumentId,
    importBatchId: r.importBatchId,
  });
  function version(record, n, changeType, reason, changedFields, at) {
    return {
      version: n,
      changeType,
      reason,
      changedBy: n === 1 ? "import" : MANAGER_ID,
      changedAtUtc: at,
      changedFields,
      snapshot: snapshot(record),
    };
  }
  function historyOf(s, record) {
    const x = ext(s);
    if (!x.versions.has(record.id))
      x.versions.set(record.id, [
        version(record, 1, "Created", null, [], `${record.transactionDate}T00:00:00Z`),
      ]);
    const versions = x.versions.get(record.id);
    return { recordId: record.id, currentVersion: versions.length, versions };
  }

  // ---------------------------------------------------------------- budgets (BUD-01..05)

  function fiscalYearOf(s, label) {
    const [y, m] = label.split("-").map(Number);
    const start = s.market.fiscalStartMonth;
    return start > 1 && m >= start ? y + 1 : y;
  }
  const fiscalBounds = (s) => ({ min: s.market.fiscalYear - 5, max: s.market.fiscalYear + 2 });

  function newBudget(s, fields) {
    return {
      id: randomUUID(),
      fiscalYear: s.market.fiscalYear,
      versionNumber: 1,
      name: "",
      status: "Draft",
      currency: s.market.currency,
      notes: null,
      basedOnBudgetId: null,
      approvalReference: null,
      approvedBy: null,
      approvedAtUtc: null,
      lines: [],
      createdBy: MANAGER_ID,
      ...fields,
    };
  }
  const budgetResult = (s, b) => {
    const lines = b.lines.map((l) => ({
      ...l,
      category: s.categories.find((c) => c.id === l.categoryId)?.name ?? null,
    }));
    const totalAdmin = round(
      s,
      sum(
        lines.filter((l) => l.fund === "Admin"),
        (l) => l.annualAmount,
      ),
    );
    const totalCapitalWorks = round(
      s,
      sum(
        lines.filter((l) => l.fund === "CapitalWorks"),
        (l) => l.annualAmount,
      ),
    );
    const { createdBy, ...rest } = b;
    void createdBy;
    return {
      ...rest,
      lines,
      totalAdmin,
      totalCapitalWorks,
      total: round(s, totalAdmin + totalCapitalWorks),
    };
  };

  function seedBudgets(s, x) {
    const monthly = new Map();
    for (const r of s.records) {
      if (r.recordType !== "Expense" || !r.categoryId || r.fund !== "Admin") continue;
      monthly.set(r.categoryId, (monthly.get(r.categoryId) ?? 0) + r.amount / s.periods.length);
    }
    const approved = newBudget(s, {
      name: s.market.language === "fa" ? "بودجه مصوب" : "Approved budget",
      status: "Approved",
      approvalReference: "AGM 2026 motion 4",
      approvedBy: MANAGER_ID,
      approvedAtUtc: "2026-06-20T08:00:00Z",
    });
    // Repairs is under-budgeted on purpose, so variance has a finding to explain.
    s.categories.forEach((c, i) => {
      const avg = monthly.get(c.id);
      if (!avg || i === 6) return;
      const factor = i === 4 ? 0.7 : 1.02;
      approved.lines.push({
        id: randomUUID(),
        categoryId: c.id,
        fund: "Admin",
        annualAmount: round(s, avg * 12 * factor),
        phasing: null,
        note: null,
      });
    });
    approved.lines.push({
      id: randomUUID(),
      categoryId: s.categories[4].id,
      fund: "CapitalWorks",
      annualAmount: round(s, 24000 * s.market.scale),
      phasing: null,
      note: null,
    });
    const draft = newBudget(s, {
      versionNumber: 2,
      name: s.market.language === "fa" ? "بازنگری میان‌سال" : "Mid-year revision",
      basedOnBudgetId: approved.id,
      notes: "Raises repairs after the September spike.",
      lines: approved.lines.map((l) => ({
        ...l,
        id: randomUUID(),
        annualAmount:
          l.categoryId === s.categories[4].id && l.fund === "Admin"
            ? round(s, l.annualAmount * 1.5)
            : l.annualAmount,
      })),
    });
    x.budgets.push(approved, draft);
  }

  function validLine(s, res, body, { creating }) {
    const fund = FUNDS[Number(body.fund ?? 1)];
    if (!fund) return bad(res, 430004, "Choose a fund.");
    if (creating && body.categoryId && !s.categories.some((c) => c.id === body.categoryId))
      return missing(res, "ExpenseCategory", "Category not found.");
    const amount = Number(body.annualAmount);
    if (!Number.isFinite(amount) || amount < 0)
      return bad(res, 430005, "The annual amount must be zero or more.");
    if (round(s, amount) !== amount)
      return bad(res, 430005, "The amount has more decimal places than the currency allows.");
    if (body.phasing !== null && body.phasing !== undefined) {
      if (!Array.isArray(body.phasing) || body.phasing.length !== 12)
        return bad(res, 430006, "Phasing needs exactly 12 values.");
      if (body.phasing.some((p) => !(Number(p) >= 0)))
        return bad(res, 430006, "Phasing values cannot be negative.");
      const total = Math.round(sum(body.phasing, Number) * 100) / 100;
      if (total !== 100) return bad(res, 430006, "Phasing must add up to 100%.");
    }
    return { fund, amount, phasing: body.phasing ?? null };
  }

  function variance(s, q, lang) {
    const x = ext(s);
    const asOf = q.get("asOf") || s.asOf;
    const fiscalYear = Number(q.get("fiscalYear")) || s.market.fiscalYear;
    const budget = q.get("budgetId")
      ? x.budgets.find((b) => b.id === q.get("budgetId"))
      : x.budgets.find((b) => b.fiscalYear === fiscalYear && b.status === "Approved");
    if (!budget)
      return {
        error:
          lang === "fa"
            ? "برای این سال مالی بودجه مصوبی وجود ندارد."
            : "There is no approved budget for this fiscal year.",
      };
    const t = Number(q.get("tolerancePercent"));
    const tolerance = t > 0 && t <= 100 ? t : 10;
    const periods = s.periods.filter(
      (p) => fiscalYearOf(s, p.label) === budget.fiscalYear && p.start <= asOf,
    );
    const elapsed = periods.length;
    const labels = new Set(periods.map((p) => p.label));
    const expenses = s.records.filter(
      (r) =>
        r.recordType === "Expense" &&
        r.status === "Verified" &&
        labels.has(r.financialPeriodId) &&
        r.transactionDate <= asOf,
    );
    const key = (categoryId, fund) => `${categoryId ?? "none"}|${fund}`;
    const actual = new Map();
    for (const r of expenses) {
      const k = key(r.categoryId, r.fund);
      const entry = actual.get(k) ?? { amount: 0, ids: [] };
      entry.amount += r.amount;
      entry.ids.push(r.id);
      actual.set(k, entry);
    }
    const lines = [];
    const status = (budgetToDate, diff) => {
      if (budgetToDate <= 0) return "NotMeaningful";
      const pct = (diff / budgetToDate) * 100;
      if (Math.abs(pct) <= tolerance) return "WithinTolerance";
      return pct > 0 ? "OverBudget" : "UnderBudget";
    };
    for (const l of budget.lines) {
      const share = l.phasing ? sum(l.phasing.slice(0, elapsed), Number) / 100 : elapsed / 12;
      const budgetToDate = round(s, l.annualAmount * share);
      const a = actual.get(key(l.categoryId, l.fund)) ?? { amount: 0, ids: [] };
      actual.delete(key(l.categoryId, l.fund));
      const diff = round(s, a.amount - budgetToDate);
      const forecast = round(s, elapsed ? (a.amount / elapsed) * 12 : l.annualAmount);
      lines.push({
        lineId: l.id,
        categoryId: l.categoryId,
        category: s.categories.find((c) => c.id === l.categoryId)?.name ?? null,
        fund: fundLabel(s, l.fund),
        annualBudget: l.annualAmount,
        budgetToDate,
        actualToDate: round(s, a.amount),
        variance: diff,
        variancePercent: budgetToDate > 0 ? Math.round((diff / budgetToDate) * 1000) / 10 : null,
        status: status(budgetToDate, diff),
        forecastFullYear: forecast,
        forecastVariance: round(s, forecast - l.annualAmount),
        recordIds: a.ids,
      });
    }
    for (const [k, a] of actual) {
      const [categoryId, fund] = k.split("|");
      const forecast = round(s, elapsed ? (a.amount / elapsed) * 12 : a.amount);
      lines.push({
        lineId: null,
        categoryId: categoryId === "none" ? null : categoryId,
        category: s.categories.find((c) => c.id === categoryId)?.name ?? null,
        fund: fundLabel(s, fund),
        annualBudget: 0,
        budgetToDate: 0,
        actualToDate: round(s, a.amount),
        variance: round(s, a.amount),
        variancePercent: null,
        status: "Unbudgeted",
        forecastFullYear: forecast,
        forecastVariance: forecast,
        recordIds: a.ids,
      });
    }
    const totalBudgetToDate = round(
      s,
      sum(lines, (l) => l.budgetToDate),
    );
    const totalActualToDate = round(
      s,
      sum(lines, (l) => l.actualToDate),
    );
    return {
      summary: {
        origin: "Deterministic",
        budgetId: budget.id,
        budgetName: budget.name,
        budgetVersion: budget.versionNumber,
        fiscalYear: budget.fiscalYear,
        currency: s.market.currency,
        asOf,
        periodsElapsed: elapsed,
        tolerancePercent: tolerance,
        totalAnnualBudget: round(
          s,
          sum(budget.lines, (l) => l.annualAmount),
        ),
        totalBudgetToDate,
        totalActualToDate,
        totalVariance: round(s, totalActualToDate - totalBudgetToDate),
        totalForecast: round(
          s,
          sum(lines, (l) => l.forecastFullYear),
        ),
        lines,
        freshness: freshness(s),
        definition:
          lang === "fa"
            ? "بودجه تا امروز سهم دوره‌های سپری‌شده از بودجه سالانه است. واقعی، جمع هزینه‌های تأییدشده همان دوره‌هاست."
            : "Budget to date is the share of the annual budget for the periods elapsed. Actual is verified expenses in those periods.",
        disclaimer:
          lang === "fa"
            ? "پیش‌بینی بر اساس روند فعلی است و تضمینی نیست."
            : "The forecast extrapolates spending so far. It is not a guarantee.",
      },
    };
  }

  function findingsOf(s, summary, lang) {
    return summary.lines
      .filter((l) => ["OverBudget", "UnderBudget", "Unbudgeted"].includes(l.status))
      .map((line) => {
        const amount = Math.abs(line.variance).toLocaleString(lang === "fa" ? "fa-IR" : "en-AU");
        const name = line.category ?? (lang === "fa" ? "بدون دسته" : "Uncategorised");
        const text =
          lang === "fa"
            ? line.status === "Unbudgeted"
              ? `برای «${name}» بودجه‌ای تعیین نشده اما ${amount} هزینه شده است.`
              : `«${name}» ${line.status === "OverBudget" ? "بیش" : "کمتر"} از بودجه است، به اندازه ${amount}.`
            : line.status === "Unbudgeted"
              ? `${name} has no budget line but ${amount} was spent.`
              : `${name} is ${amount} ${line.status === "OverBudget" ? "over" : "under"} budget to date.`;
        const top = s.records
          .filter((r) => line.recordIds.includes(r.id))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
          .map((r) => r.id);
        return { line, explanation: text, topRecordIds: top };
      });
  }

  // ---------------------------------------------------------------- reminders (ARR-08)

  function draftReminders(s, x, input) {
    const asOf = input.asOf || s.asOf;
    const items = [];
    for (const lot of s.lots) {
      const balance = lotBalance(s, lot, asOf);
      if (balance.overdue <= 0) continue;
      if (balance.overdue < input.minimumOverdue) continue;
      if (balance.daysOverdue < input.minimumDaysOverdue) continue;
      if (balance.hasPaymentPlan && !input.includePaymentPlans) continue;
      const owner = x.tenures.find(
        (t) => t.lotId === lot.id && t.kind === "Ownership" && !t.endDate && t.userId,
      );
      items.push({
        id: randomUUID(),
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        hasRecipient: Boolean(owner),
        overdue: balance.overdue,
        daysOverdue: balance.daysOverdue,
        hasPaymentPlan: balance.hasPaymentPlan,
        status: owner ? "Pending" : "Skipped",
        skipReason: owner ? null : "no owner account to contact",
        sentAtUtc: null,
        error: null,
      });
    }
    if (items.length === 0) return null;
    items.sort((a, b) => b.overdue - a.overdue);
    const fa = input.lang === "fa";
    return {
      id: randomUUID(),
      status: "Draft",
      asOf,
      minimumOverdue: input.minimumOverdue,
      minimumDaysOverdue: input.minimumDaysOverdue,
      includePaymentPlans: input.includePaymentPlans,
      language: fa ? "fa" : "en",
      currency: s.market.currency,
      note: input.note ?? null,
      createdBy: input.createdBy,
      reviewedBy: null,
      reviewedAtUtc: null,
      rejectionReason: null,
      items,
      messagePreview: fa
        ? `مالک گرامی واحد {lot}، مبلغ {amount} از شارژ شما از سررسید گذشته است. لطفاً پرداخت کنید یا با مدیر ساختمان تماس بگیرید. — ${s.title}`
        : `Dear owner of lot {lot}, {amount} of your levies is overdue. Please pay or contact your strata manager. — ${s.title}`,
      definition: fa
        ? "شامل واحدهایی است که بدهی معوق آن‌ها از حداقل‌ها بیشتر است."
        : "Includes lots whose overdue balance meets both minimums on the as-of date.",
      disclaimer: fa
        ? "پیش از ارسال، فهرست را با سوابق خود مقایسه کنید."
        : "Check the list against your own records before approving. Messages go out only after approval.",
    };
  }
  const batchResult = (b) => ({
    ...b,
    sendableCount: b.items.filter((i) => i.hasRecipient && i.status !== "Skipped").length,
    totalOverdue: sum(
      b.items.filter((i) => i.status !== "Skipped"),
      (i) => i.overdue,
    ),
  });

  // ---------------------------------------------------------------- capital funding (CAP-04/08)

  const SOURCE_TYPES = {
    1: "CapitalWorksFund",
    2: "AdminFund",
    3: "SpecialLevy",
    4: "Loan",
    5: "Grant",
    6: "Insurance",
    7: "Other",
  };
  function itemResult(s, item) {
    const sources = ext(s).fundingSources.get(item.id) ?? [];
    const external = Math.min(
      item.currentEstimate,
      sum(
        sources.filter((x) => x.sourceType !== "CapitalWorksFund"),
        (x) => x.amount,
      ),
    );
    return {
      ...item,
      externalFunding: round(s, external),
      fundedFromCapitalWorksFund: round(s, item.currentEstimate - external),
      fundingSources: sources,
    };
  }

  function contributionImpact(s, sc, lang, res) {
    const totalEntitlement = sum(s.lots, (l) => l.entitlement ?? 0);
    if (!totalEntitlement)
      return bad(
        res,
        360104,
        "Lot entitlements are missing, so contributions cannot be apportioned.",
      );
    const base = projection(s, sc, lang);
    let increase = 0;
    if (base.maximumShortfall > 0) {
      let low = 0;
      let high = base.maximumShortfall;
      for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2;
        const p = projection(s, { ...sc, annualContribution: sc.annualContribution + mid }, lang);
        if (p.maximumShortfall > 0) low = mid;
        else high = mid;
      }
      increase = round(s, high);
    }
    const withIncrease = projection(
      s,
      { ...sc, annualContribution: sc.annualContribution + increase },
      lang,
    );
    const fa = lang === "fa";
    return ok(res, {
      origin: "Deterministic",
      scenario: sc,
      currency: s.market.currency,
      maximumShortfall: round(s, base.maximumShortfall),
      firstShortfallYear: base.firstShortfallYear,
      specialLevyTotal: round(s, base.maximumShortfall),
      requiredAnnualIncrease: increase,
      newAnnualContribution: round(s, sc.annualContribution + increase),
      endingBalanceWithIncrease: round(s, withIncrease.endingBalance),
      totalEntitlement,
      lots: s.lots.map((lot) => {
        const share = (lot.entitlement ?? 0) / totalEntitlement;
        return {
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          entitlement: lot.entitlement ?? 0,
          sharePercent: Math.round(share * 10000) / 100,
          currentAnnualContribution: round(s, sc.annualContribution * share),
          specialLevy: round(s, base.maximumShortfall * share),
          annualIncrease: round(s, increase * share),
        };
      }),
      definition: fa
        ? "شارژ ویژه بیشترین کسری را پوشش می‌دهد. افزایش سالانه کمترین افزایشی است که کسری را از بین می‌برد. سهم هر واحد بر اساس سهم مالکیت است."
        : "The special levy covers the largest shortfall at once. The annual increase is the smallest rise that avoids any shortfall. Each lot's share follows unit entitlement.",
      disclaimer: base.disclaimer,
    });
  }

  // ---------------------------------------------------------------- AI documents and questions

  function extraction(s, { fileName, createdAt, supplierIndex, amount, date, failed = false }) {
    const supplier = s.suppliers[supplierIndex % s.suppliers.length];
    const invoice = `INV-${Math.floor(10000 + Math.random() * 89999)}`;
    const fields = failed
      ? []
      : [
          { name: "SupplierName", value: supplier.name, confidence: 0.94, grounded: true },
          { name: "SupplierTaxId", value: null, confidence: 0, grounded: false },
          { name: "InvoiceNumber", value: invoice, confidence: 0.97, grounded: true },
          { name: "InvoiceDate", value: date, confidence: 0.91, grounded: true },
          { name: "DueDate", value: addDays(date, 14), confidence: 0.62, grounded: true },
          { name: "Total", value: String(amount), confidence: 0.96, grounded: true },
          {
            name: "Description",
            value: "Plumbing repairs, level 2",
            confidence: 0,
            grounded: false,
          },
        ];
    return {
      origin: "AiGenerated",
      id: randomUUID(),
      fileName,
      pageCount: 1,
      status: failed ? "Failed" : "PendingReview",
      overallConfidence: failed ? 0 : 0.78,
      fields,
      suggestion: failed
        ? {
            amount: null,
            transactionDate: null,
            dueDate: null,
            supplierId: null,
            supplierName: null,
            externalReference: null,
            description: null,
          }
        : {
            amount,
            transactionDate: date,
            dueDate: addDays(date, 14),
            supplierId: supplier.id,
            supplierName: supplier.name,
            externalReference: invoice,
            description: null,
          },
      modelName: "mock-extractor",
      modelVersion: "1",
      promptTemplateId: "invoice-extraction",
      promptTemplateVersion: "2",
      failureReason: failed ? "The model did not return a usable result." : null,
      reviewedBy: null,
      reviewedAtUtc: null,
      reviewNote: null,
      financialRecordId: null,
      createdAtUtc: createdAt ?? nowUtc(),
    };
  }

  const SUPPORTED_EN = [
    "How much did we spend this year?",
    "What did we spend by category last month?",
    "Who are our top suppliers this year?",
    "How much is overdue?",
    "Which lots owe the most?",
    "Will the capital works fund run short?",
    "How are we tracking against the budget?",
  ];
  const SUPPORTED_FA = [
    "امسال چقدر هزینه کرده‌ایم؟",
    "ماه گذشته به تفکیک دسته چقدر هزینه شد؟",
    "بزرگ‌ترین پیمانکاران امسال چه کسانی هستند؟",
    "چقدر بدهی معوق داریم؟",
    "کدام واحدها بیشترین بدهی را دارند؟",
    "آیا صندوق عمرانی کم می‌آورد؟",
    "نسبت به بودجه چطور پیش می‌رویم؟",
  ];

  function answer(s, question, lang, user) {
    const text = question.toLowerCase();
    const fa = lang === "fa";
    const intent = /budget|بودجه/.test(text)
      ? "BudgetVariance"
      : /capital|shortfall|sinking|عمرانی|کسری/.test(text)
        ? "FundingGap"
        : /which lots|owe the most|top arrears|بیشترین بدهی/.test(text)
          ? "TopArrearsLots"
          : /overdue|arrears|owe|معوق|بدهی/.test(text)
            ? "ArrearsSummary"
            : /supplier|vendor|پیمانکار/.test(text)
              ? "TopSuppliers"
              : /category|دسته/.test(text)
                ? "SpendByCategory"
                : /spend|spent|cost|هزینه/.test(text)
                  ? "SpendTotal"
                  : null;
    const common = {
      origin: "AiPlannedDeterministicAnswer",
      question,
      currency: s.market.currency,
      modelName: "mock-planner",
      modelVersion: "1",
      promptTemplateId: "question-plan",
      promptTemplateVersion: "1",
      supportedQuestions: fa ? SUPPORTED_FA : SUPPORTED_EN,
      disclaimer: fa
        ? "ارقام از سوابق تأییدشده محاسبه شده‌اند؛ مدل فقط نوع پرسش را تشخیص داده است."
        : "Figures are calculated from verified records. The model only chose which calculation to run.",
    };
    if (!intent)
      return {
        ...common,
        insightId: null,
        status: "Unsupported",
        intent: null,
        period: null,
        from: null,
        to: null,
        answer: fa
          ? "این پرسش را نمی‌توانم از داده‌های تأییدشده پاسخ دهم. یکی از پرسش‌های زیر را امتحان کنید."
          : "I can't answer that from verified data. Try one of the questions below.",
        figures: [],
        evidenceRecordIds: [],
        confidence: 0.2,
        freshness: null,
      };

    const fy = s.market.fiscalYear;
    const yearLabels = new Set(
      s.periods.filter((p) => fiscalYearOf(s, p.label) === fy).map((p) => p.label),
    );
    const yearExpenses = s.records.filter(
      (r) =>
        r.recordType === "Expense" &&
        r.status === "Verified" &&
        yearLabels.has(r.financialPeriodId),
    );
    const from = s.periods.find((p) => yearLabels.has(p.label))?.start ?? null;
    let figures = [];
    let evidence = [];
    let sentence = "";
    let period = "this-year";
    const top = (key, names) => {
      const totals = new Map();
      for (const r of yearExpenses) totals.set(r[key], (totals.get(r[key]) ?? 0) + r.amount);
      return [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, amount]) => ({
          label: names.find((n) => n.id === id)?.name ?? (fa ? "نامشخص" : "Unknown"),
          amount: round(s, amount),
        }));
    };
    switch (intent) {
      case "SpendTotal":
        figures = [
          {
            label: fa ? "جمع هزینه‌ها" : "Total spend",
            amount: round(
              s,
              sum(yearExpenses, (r) => r.amount),
            ),
          },
        ];
        evidence = yearExpenses.slice(0, 20).map((r) => r.id);
        sentence = fa
          ? "جمع هزینه‌های تأییدشده امسال."
          : "Total verified spending this fiscal year.";
        break;
      case "SpendByCategory":
        figures = top("categoryId", s.categories);
        evidence = yearExpenses.slice(0, 20).map((r) => r.id);
        sentence = fa ? "هزینه‌ها به تفکیک دسته." : "Spending this fiscal year by category.";
        break;
      case "TopSuppliers":
        figures = top("supplierId", s.suppliers);
        evidence = yearExpenses.slice(0, 20).map((r) => r.id);
        sentence = fa ? "بزرگ‌ترین پیمانکاران امسال." : "Your largest suppliers this fiscal year.";
        break;
      case "ArrearsSummary":
      case "TopArrearsLots": {
        period = "as-of";
        const balances = s.lots.map((l) => lotBalance(s, l)).filter((b) => b.overdue > 0);
        figures =
          intent === "ArrearsSummary"
            ? [
                {
                  label: fa ? "جمع معوق" : "Total overdue",
                  amount: round(
                    s,
                    sum(balances, (b) => b.overdue),
                  ),
                },
              ]
            : balances
                .sort((a, b) => b.overdue - a.overdue)
                .slice(0, 5)
                .map((b) => ({
                  label: `${fa ? "واحد" : "Lot"} ${b.lot}`,
                  amount: round(s, b.overdue),
                }));
        sentence =
          intent === "ArrearsSummary"
            ? fa
              ? `${balances.length} واحد بدهی معوق دارند.`
              : `${balances.length} lots have overdue levies.`
            : fa
              ? "واحدهایی با بیشترین بدهی معوق."
              : "The lots with the largest overdue balances.";
        break;
      }
      case "FundingGap": {
        period = "horizon";
        const sc = s.scenarios.find((x) => x.isBaseline) ?? s.scenarios[0];
        const p = sc ? projection(s, sc, lang) : null;
        figures = p
          ? [
              {
                label: fa ? "بیشترین کسری" : "Largest shortfall",
                amount: round(s, p.maximumShortfall),
              },
              {
                label: fa ? "مانده پایان دوره" : "Ending balance",
                amount: round(s, p.endingBalance),
              },
            ]
          : [];
        sentence = p?.firstShortfallYear
          ? fa
            ? `در سناریوی پایه، صندوق از سال ${p.firstShortfallYear} کسری دارد.`
            : `In the baseline scenario the fund first runs short in ${p.firstShortfallYear}.`
          : fa
            ? "در سناریوی پایه کسری‌ای پیش‌بینی نمی‌شود."
            : "The baseline scenario shows no shortfall.";
        break;
      }
      case "BudgetVariance": {
        const result = variance(s, new URLSearchParams(), lang);
        if (result.error)
          return {
            ...common,
            insightId: null,
            status: "Unavailable",
            intent,
            period,
            from,
            to: s.asOf,
            answer: fa
              ? "بودجه مصوبی برای امسال وجود ندارد."
              : "There is no approved budget for this year.",
            figures: [],
            evidenceRecordIds: [],
            confidence: 0.8,
            freshness: freshness(s),
          };
        const sm = result.summary;
        figures = [
          { label: fa ? "بودجه تا امروز" : "Budget to date", amount: sm.totalBudgetToDate },
          { label: fa ? "واقعی تا امروز" : "Actual to date", amount: sm.totalActualToDate },
          { label: fa ? "اختلاف" : "Variance", amount: sm.totalVariance },
        ];
        sentence = fa
          ? "وضعیت هزینه‌ها نسبت به بودجه مصوب."
          : "Spending against the approved budget so far.";
        break;
      }
    }
    const insightId = randomUUID();
    audit({
      schemeId: s.id,
      actorId: user,
      category: "Ai",
      action: "ai.question-answered",
      entityType: "AiInsight",
      entityId: insightId,
      after: { Intent: intent },
    });
    return {
      ...common,
      insightId,
      status: "Answered",
      intent,
      period,
      from,
      to: s.asOf,
      answer: sentence,
      figures,
      evidenceRecordIds: evidence,
      confidence: 0.88,
      freshness: freshness(s),
    };
  }

  // ---------------------------------------------------------------- portfolio and onboarding

  function attentionScore(row) {
    let score = 0;
    if (row.totalOverdue > 0) score += 1;
    if (row.lotsInArrears >= 3) score += 1;
    if (row.openExpenseFlags > 0) score += 1;
    if (row.firstShortfallYear) score += 1;
    if (row.hasUnverifiedData || !row.latestVerifiedDate) score += 1;
    return score;
  }

  function portfolio(user, organisationId, lang) {
    let list = [...schemes.values()].filter((s) => s.status === "Active");
    if (organisationId) list = list.filter((s) => s.organisationId === organisationId);
    const rows = list.slice(0, 50).map((s) => {
      const h = financialHealth(s, lang);
      const row = {
        schemeId: s.id,
        title: s.title,
        jurisdictionCode: s.jurisdictionCode,
        currency: s.market.currency,
        role: roleOf(s, user),
        accessSource: "Membership",
        adminFund: h.adminFund.balance,
        capitalWorksFund: h.capitalWorksFund.balance,
        totalOutstanding: h.arrears.totalOutstanding,
        totalOverdue: h.arrears.totalOverdue,
        lotsInArrears: h.arrears.lotsInArrears,
        openExpenseFlags: s.flags.filter((f) => f.status === "Open").length,
        firstShortfallYear: h.capitalWorks.firstShortfallYear,
        maximumShortfall: round(s, h.capitalWorks.maximumShortfall),
        latestVerifiedDate: h.freshness.latestVerifiedTransactionDate,
        hasUnverifiedData: h.freshness.hasUnverifiedData,
      };
      return { ...row, attentionScore: attentionScore(row) };
    });
    rows.sort((a, b) => b.attentionScore - a.attentionScore || b.totalOverdue - a.totalOverdue);
    const totals = new Map();
    for (const r of rows) {
      const t = totals.get(r.currency) ?? {
        currency: r.currency,
        schemes: 0,
        adminFund: 0,
        capitalWorksFund: 0,
        totalOutstanding: 0,
        totalOverdue: 0,
        maximumShortfall: 0,
      };
      t.schemes += 1;
      t.adminFund += r.adminFund;
      t.capitalWorksFund += r.capitalWorksFund;
      t.totalOutstanding += r.totalOutstanding;
      t.totalOverdue += r.totalOverdue;
      t.maximumShortfall += r.maximumShortfall;
      totals.set(r.currency, t);
    }
    const minor = (currency) =>
      [...schemes.values()].find((s) => s.market.currency === currency) ?? null;
    const rounded = [...totals.values()].map((t) => {
      const s = minor(t.currency);
      const r = (n) => (s ? round(s, n) : n);
      return {
        ...t,
        adminFund: r(t.adminFund),
        capitalWorksFund: r(t.capitalWorksFund),
        totalOutstanding: r(t.totalOutstanding),
        totalOverdue: r(t.totalOverdue),
        maximumShortfall: r(t.maximumShortfall),
      };
    });
    return { origin: "Deterministic", schemeCount: rows.length, totals: rounded, schemes: rows };
  }

  function onboarding(s, lang) {
    const x = ext(s);
    const fa = lang === "fa";
    const committed = s.imports.filter((b) => b.status === "Committed");
    const steps = [
      ["lots", "Add lots", "افزودن واحدها", s.lots.length > 0, `${s.lots.length} lots`],
      [
        "members",
        "Invite members",
        "دعوت اعضا",
        s.members.length > 1,
        `${s.members.length} members`,
      ],
      [
        "office-holders",
        "Record office holders",
        "ثبت اعضای هیئت مدیره",
        x.officeHolders.length > 0,
        null,
      ],
      [
        "first-import",
        "Import a file",
        "ورود اولین فایل",
        committed.length > 0 || s.records.length > 0,
        null,
      ],
      [
        "first-verified",
        "Verify an import",
        "تأیید یک ورود",
        s.records.some((r) => r.status === "Verified"),
        null,
      ],
      ["first-dashboard", "Open the dashboard", "مشاهده داشبورد", true, null],
      [
        "budget",
        "Approve a budget",
        "تصویب بودجه",
        x.budgets.some((b) => b.status === "Approved"),
        null,
      ],
      [
        "capital-plan",
        "Add a capital works plan",
        "افزودن برنامه عمرانی",
        s.works.length > 0,
        null,
      ],
      ["first-report", "Generate a report", "تهیه گزارش", s.reports.length > 0, null],
      ["feedback", "Send feedback", "ارسال بازخورد", s.feedback.length > 0, null],
    ].map(([code, en, faTitle, done, evidence], i) => ({
      order: i + 1,
      code,
      title: fa ? faTitle : en,
      done,
      evidence: done ? evidence : null,
    }));
    const completed = steps.filter((st) => st.done).length;
    return {
      schemeId: s.id,
      completedSteps: completed,
      totalSteps: steps.length,
      percentComplete: Math.round((completed / steps.length) * 100),
      nextStep: steps.find((st) => !st.done)?.code ?? null,
      steps,
    };
  }

  // ---------------------------------------------------------------- client: global routes

  async function globalRoutes(req, res, path, q, lang, user) {
    if (path.startsWith("product/")) return productRoutes(req, res, path, q, lang);
    if (path === "organisations/mine" && req.method === "GET") {
      const mine = [];
      for (const org of organisations) {
        const member = org.members.find((x) => x.userId === user.sub && x.status === "Active");
        if (!member) continue;
        const manages = ["Owner", "Admin"].includes(member.role) && org.status === "Active";
        mine.push({
          organisationId: org.id,
          name: org.name,
          role: member.role,
          countryCode: org.countryCode,
          status: org.status,
          schemes: manages
            ? org.schemeIds
                .map((id) => schemes.get(id))
                .filter(Boolean)
                .map(orgScheme)
            : [],
        });
      }
      return ok(
        res,
        mine.sort((a, b) => a.name.localeCompare(b.name)),
      );
    }
    if (path === "portfolio" && req.method === "GET") {
      const organisationId = Number(q.get("organisationId")) || null;
      return ok(res, portfolio(user.sub, organisationId, lang));
    }
    return undefined;
  }

  // ---------------------------------------------------------------- client: scheme routes

  async function schemeRoutes(req, res, s, rest, q, lang, user) {
    const m = req.method;
    let match;
    const x = ext(s);
    const need = (permission) => (can(s, user, permission) ? null : forbidden(res));

    // --- audit
    if (rest === "audit-logs" && m === "GET") {
      if (!can(s, user, "ViewAudit")) {
        accessDenied?.unshift({
          id: randomUUID(),
          userId: user,
          schemeId: s.id,
          resource: "audit-logs",
          requiredAccess: "ViewAudit",
          occurredAt: nowUtc(),
        });
        return forbidden(res);
      }
      return filterAudit(
        res,
        q,
        auditLog.filter((e) => e.schemeId === s.id),
      );
    }

    // --- property history
    if ((match = /^lots\/(\d+)\/(tenures|holders|ownership-transfers|occupancies)$/.exec(rest))) {
      const lot = s.lots.find((l) => l.id === Number(match[1]));
      if (!lot) return missing(res, "Lot", "Lot not found.");
      const kind = match[2];
      if (kind === "tenures" && m === "GET") {
        const list = x.tenures
          .filter((t) => t.lotId === lot.id)
          .sort(
            (a, b) =>
              (a.kind === "Ownership" ? 0 : 1) - (b.kind === "Ownership" ? 0 : 1) ||
              b.startDate.localeCompare(a.startDate),
          );
        return ok(res, list);
      }
      if (kind === "holders" && m === "GET") {
        const asOf = q.get("asOf") || s.asOf;
        const live = x.tenures.filter(
          (t) => t.lotId === lot.id && t.startDate <= asOf && (!t.endDate || t.endDate >= asOf),
        );
        const owners = live.filter((t) => t.kind === "Ownership");
        const owned = Math.round(sum(owners, (t) => t.sharePercent ?? 0) * 100) / 100;
        return ok(res, {
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          asOf,
          owners,
          occupants: live.filter((t) => t.kind === "Occupancy"),
          ownedSharePercent: owned,
          ownershipComplete: owned === 100,
        });
      }
      if (kind === "ownership-transfers" && m === "POST") {
        const denied = need("ManageProperty");
        if (denied) return denied;
        const body = await readJson(req);
        const owners = Array.isArray(body.owners) ? body.owners : [];
        const total = Math.round(sum(owners, (o) => Number(o.sharePercent) || 0) * 100) / 100;
        if (
          owners.length === 0 ||
          owners.some((o) => !(o.sharePercent > 0 && o.sharePercent <= 100)) ||
          owners.some((o) => !o.userId && !String(o.partyName ?? "").trim()) ||
          total !== 100
        )
          return bad(res, 420002, "Owner shares must each be above 0 and add up to 100%.");
        const date = body.effectiveDate;
        if (!date) return bad(res, 420004, "An effective date is required.");
        const current = x.tenures.filter((t) => t.lotId === lot.id && t.kind === "Ownership");
        if (current.some((t) => t.startDate >= date))
          return bad(res, 420003, "An ownership record already starts on or after this date.");
        for (const t of current.filter((t) => !t.endDate)) {
          t.endDate = addDays(date, -1);
          t.endReason = "ownership transferred";
        }
        const added = owners.map((o) =>
          tenure({
            lotId: lot.id,
            userId: o.userId || null,
            partyName: o.userId ? null : o.partyName.trim(),
            sharePercent: Number(o.sharePercent),
            startDate: date,
            source: "Transfer",
            reference: body.reference || null,
          }),
        );
        x.tenures.push(...added);
        audit({
          schemeId: s.id,
          actorId: user,
          category: "Property",
          action: "lot.ownership-transferred",
          entityType: "Lot",
          entityId: lot.id,
          after: { EffectiveDate: date, Owners: added.length },
        });
        return created(res, added);
      }
      if (kind === "occupancies" && m === "POST") {
        const denied = need("ManageProperty");
        if (denied) return denied;
        const body = await readJson(req);
        const role = { 1: "Owner", 2: "FamilyMember", 3: "Tenant", 4: "Occupant" }[
          Number(body.role)
        ];
        if (!role || (!body.userId && !String(body.partyName ?? "").trim()))
          return bad(res, 420006, "Choose a role and name the occupant.");
        if (!body.startDate) return bad(res, 420004, "A start date is required.");
        if (body.endDate && body.endDate < body.startDate)
          return bad(res, 420004, "The end date cannot be before the start date.");
        const party = body.userId || body.partyName.trim();
        const overlap = x.tenures.some(
          (t) =>
            t.lotId === lot.id &&
            t.kind === "Occupancy" &&
            (t.userId || t.partyName) === party &&
            (!t.endDate || t.endDate >= body.startDate) &&
            (!body.endDate || t.startDate <= body.endDate),
        );
        if (overlap)
          return bad(res, 420003, "This person already occupies the lot in that period.");
        const t = tenure({
          lotId: lot.id,
          kind: "Occupancy",
          role,
          userId: body.userId || null,
          partyName: body.userId ? null : body.partyName.trim(),
          startDate: body.startDate,
          endDate: body.endDate || null,
          source: "Manual",
          reference: body.reference || null,
        });
        x.tenures.push(t);
        audit({
          schemeId: s.id,
          actorId: user,
          category: "Property",
          action: "lot.occupancy-started",
          entityType: "LotTenure",
          entityId: t.id,
          after: { Role: role, StartDate: t.startDate },
        });
        return created(res, t);
      }
    }
    if ((match = /^tenures\/([0-9a-f-]{36})\/end$/i.exec(rest)) && m === "POST") {
      const denied = need("ManageProperty");
      if (denied) return denied;
      const t = x.tenures.find((y) => y.id === match[1]);
      if (!t) return missing(res, "LotTenure", "Tenure not found.");
      const body = await readJson(req);
      if (!body.endDate || body.endDate < t.startDate)
        return bad(res, 420004, "The end date cannot be before the start date.");
      t.endDate = body.endDate;
      t.endReason = body.reason || null;
      audit({
        schemeId: s.id,
        actorId: user,
        category: "Property",
        action: "lot.tenure-ended",
        entityType: "LotTenure",
        entityId: t.id,
        before: { EndDate: null },
        after: { EndDate: t.endDate },
        reason: t.endReason,
      });
      return ok(res, t);
    }
    if (rest === "office-holders" && m === "GET") {
      const includeEnded = q.get("includeEnded") === "true";
      const today = s.asOf;
      return ok(
        res,
        x.officeHolders
          .filter((o) => includeEnded || !o.termEnd || o.termEnd >= today)
          .map((o) => ({
            ...o,
            isCurrent: o.termStart <= today && (!o.termEnd || o.termEnd >= today),
          })),
      );
    }
    if (rest === "office-holders" && m === "POST") {
      const denied = need("ManageMembers");
      if (denied) return denied;
      const body = await readJson(req);
      const office = [
        null,
        "Chairperson",
        "Secretary",
        "Treasurer",
        "CommitteeMember",
        "StrataManagingAgent",
        "BuildingManager",
        "Auditor",
      ][Number(body.office)];
      if (
        !office ||
        (!body.userId && !body.organisationId && !String(body.externalName ?? "").trim())
      )
        return bad(res, 420006, "Choose an office and who holds it.");
      if (!body.termStart) return bad(res, 420004, "A term start is required.");
      if (body.termEnd && body.termEnd < body.termStart)
        return bad(res, 420004, "The term cannot end before it starts.");
      if (body.organisationId && !organisations.some((o) => o.id === Number(body.organisationId)))
        return missing(res, "Organisation", "Organisation not found.");
      if (
        office !== "CommitteeMember" &&
        x.officeHolders.some(
          (o) =>
            o.office === office &&
            (!o.termEnd || o.termEnd >= body.termStart) &&
            (!body.termEnd || o.termStart <= body.termEnd),
        )
      )
        return bad(res, 420007, "Someone already holds this office for part of that term.");
      const holder = {
        id: randomUUID(),
        office,
        userId: body.userId || null,
        organisationId: body.organisationId ? Number(body.organisationId) : null,
        externalName: body.externalName || null,
        termStart: body.termStart,
        termEnd: body.termEnd || null,
        appointmentReference: body.appointmentReference || null,
        endReason: null,
      };
      x.officeHolders.push(holder);
      audit({
        schemeId: s.id,
        actorId: user,
        category: "Property",
        action: "office-holder.appointed",
        entityType: "SchemeOfficeHolder",
        entityId: holder.id,
        after: { Office: office, TermStart: holder.termStart },
      });
      return created(res, { ...holder, isCurrent: holder.termStart <= s.asOf });
    }
    if ((match = /^office-holders\/([0-9a-f-]{36})\/end$/i.exec(rest)) && m === "POST") {
      const denied = need("ManageMembers");
      if (denied) return denied;
      const holder = x.officeHolders.find((o) => o.id === match[1]);
      if (!holder) return missing(res, "SchemeOfficeHolder", "Office holder not found.");
      const body = await readJson(req);
      if (!body.termEnd || body.termEnd < holder.termStart)
        return bad(res, 420004, "The term cannot end before it starts.");
      holder.termEnd = body.termEnd;
      holder.endReason = body.reason || null;
      audit({
        schemeId: s.id,
        actorId: user,
        category: "Property",
        action: "office-holder.term-ended",
        entityType: "SchemeOfficeHolder",
        entityId: holder.id,
        after: { TermEnd: holder.termEnd },
        reason: holder.endReason,
      });
      return ok(res, { ...holder, isCurrent: holder.termEnd >= s.asOf });
    }

    // --- record versions
    if (
      (match = /^financial-records\/([0-9a-f-]{36})\/versions(?:\/(\d+))?$/i.exec(rest)) &&
      m === "GET"
    ) {
      const record = s.records.find((r) => r.id === match[1]);
      if (!record) return missing(res, "FinancialRecord", "Record not found.");
      const history = historyOf(s, record);
      if (!match[2]) return ok(res, history);
      const v = history.versions.find((y) => y.version === Number(match[2]));
      return v ? ok(res, v) : missing(res, "FinancialRecordVersion", "Version not found.");
    }

    // --- budgets
    if (rest === "budgets" && m === "GET") {
      const fy = Number(q.get("fiscalYear"));
      return ok(
        res,
        x.budgets
          .filter((b) => !fy || b.fiscalYear === fy)
          .sort((a, b) => b.fiscalYear - a.fiscalYear || b.versionNumber - a.versionNumber)
          .map((b) => budgetResult(s, b)),
      );
    }
    if (rest === "budgets" && m === "POST") {
      const denied = need("ManageFinancials");
      if (denied) return denied;
      const body = await readJson(req);
      const fy = Number(body.fiscalYear);
      const bounds = fiscalBounds(s);
      if (!Number.isInteger(fy) || fy < bounds.min || fy > bounds.max)
        return bad(res, 430001, `The fiscal year must be between ${bounds.min} and ${bounds.max}.`);
      if (!String(body.name ?? "").trim()) return bad(res, 430002, "A name is required.");
      const source = body.copyFromBudgetId
        ? x.budgets.find((b) => b.id === body.copyFromBudgetId)
        : null;
      if (body.copyFromBudgetId && !source) return missing(res, "Budget", "Budget not found.");
      const budget = newBudget(s, {
        fiscalYear: fy,
        versionNumber:
          Math.max(0, ...x.budgets.filter((b) => b.fiscalYear === fy).map((b) => b.versionNumber)) +
          1,
        name: body.name.trim(),
        notes: body.notes || null,
        basedOnBudgetId: source?.id ?? null,
        lines: source ? source.lines.map((l) => ({ ...l, id: randomUUID() })) : [],
        createdBy: user,
      });
      x.budgets.push(budget);
      audit({
        schemeId: s.id,
        actorId: user,
        category: "Financial",
        action: "budget.created",
        entityType: "Budget",
        entityId: budget.id,
        after: { FiscalYear: fy, Version: budget.versionNumber },
      });
      return created(res, budgetResult(s, budget));
    }
    if (rest === "budgets/vs-actual" && m === "GET") {
      const result = variance(s, q, lang);
      return result.error ? bad(res, 430010, result.error) : ok(res, result.summary);
    }
    if (rest === "budgets/variance" && m === "GET") {
      const result = variance(s, q, lang);
      if (result.error) return bad(res, 430010, result.error);
      return ok(res, {
        origin: "Deterministic",
        summary: result.summary,
        findings: findingsOf(s, result.summary, lang),
      });
    }
    if ((match = /^budgets\/([0-9a-f-]{36})(\/.*)?$/i.exec(rest))) {
      const budget = x.budgets.find((b) => b.id === match[1]);
      if (!budget) return missing(res, "Budget", "Budget not found.");
      const sub = match[2] ?? "";
      if (!sub && m === "GET") return ok(res, budgetResult(s, budget));
      if (sub === "/approve" && m === "POST") {
        const denied = need("ApproveBudgets");
        if (denied) return denied;
        if (budget.status !== "Draft")
          return bad(res, 430007, "Only a draft budget can be approved.");
        const body = await readJson(req);
        if (!String(body.approvalReference ?? "").trim())
          return bad(res, 430008, "An approval reference is required, such as the meeting motion.");
        if (budget.lines.length === 0)
          return bad(res, 430003, "Add at least one line before approving.");
        for (const other of x.budgets)
          if (other.fiscalYear === budget.fiscalYear && other.status === "Approved")
            other.status = "Superseded";
        Object.assign(budget, {
          status: "Approved",
          approvalReference: body.approvalReference.trim(),
          approvedBy: user,
          approvedAtUtc: nowUtc(),
        });
        audit({
          schemeId: s.id,
          actorId: user,
          category: "Approval",
          action: "budget.approved",
          entityType: "Budget",
          entityId: budget.id,
          before: { Status: "Draft" },
          after: { Status: "Approved", ApprovalReference: budget.approvalReference },
        });
        return ok(res, budgetResult(s, budget));
      }
      if (sub === "/lines" && m === "POST") {
        const denied = need("ManageFinancials");
        if (denied) return denied;
        if (budget.status !== "Draft")
          return bad(res, 430007, "Only a draft budget can be changed.");
        const body = await readJson(req);
        const line = validLine(s, res, body, { creating: true });
        if (!line.fund) return line;
        if (
          budget.lines.some(
            (l) => l.categoryId === (body.categoryId || null) && l.fund === line.fund,
          )
        )
          return bad(res, 430009, "This budget already has a line for that category and fund.");
        budget.lines.push({
          id: randomUUID(),
          categoryId: body.categoryId || null,
          fund: line.fund,
          annualAmount: line.amount,
          phasing: line.phasing,
          note: body.note || null,
        });
        return ok(res, budgetResult(s, budget));
      }
      const lineMatch = /^\/lines\/([0-9a-f-]{36})$/i.exec(sub);
      if (lineMatch) {
        const denied = need("ManageFinancials");
        if (denied) return denied;
        if (budget.status !== "Draft")
          return bad(res, 430007, "Only a draft budget can be changed.");
        const line = budget.lines.find((l) => l.id === lineMatch[1]);
        if (!line) return missing(res, "BudgetLine", "Budget line not found.");
        if (m === "PUT") {
          const body = await readJson(req);
          const parsed = validLine(s, res, body, { creating: false });
          if (!parsed.fund) return parsed;
          Object.assign(line, {
            annualAmount: parsed.amount,
            phasing: parsed.phasing,
            note: body.note || null,
          });
          return ok(res, budgetResult(s, budget));
        }
        if (m === "DELETE") {
          budget.lines = budget.lines.filter((l) => l !== line);
          return ok(res, budgetResult(s, budget));
        }
      }
    }

    // --- committee pack
    if (
      (rest === "reports/committee-pack" || rest === "reports/committee-pack/pdf") &&
      m === "GET"
    ) {
      const asOf = q.get("asOf") || s.asOf;
      if (rest.endsWith("/pdf")) {
        if (!can(s, user, "ExportReports")) return forbidden(res);
        audit({
          schemeId: s.id,
          actorId: user,
          category: "Export",
          action: "report.committee-pack-exported",
          entityType: "Scheme",
          entityId: s.id,
        });
        const pdf = deps.minimalPdf(`${s.title} committee pack ${asOf}`);
        res.writeHead(200, {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="committee-pack-${s.id}-${asOf}.pdf"`,
        });
        res.end(pdf);
        return true;
      }
      const result = variance(s, new URLSearchParams({ asOf }), lang);
      const fa = lang === "fa";
      const drafts = x.budgets.filter((b) => b.status === "Draft");
      const decisions = [
        ...drafts.map((b) => ({
          code: "approve-budget",
          text: fa ? `تصویب «${b.name}»` : `Approve "${b.name}" (version ${b.versionNumber}).`,
          referenceId: b.id,
        })),
        ...(x.budgets.some((b) => b.status === "Approved")
          ? []
          : [
              {
                code: "no-budget",
                text: fa ? "بودجه مصوبی وجود ندارد." : "No budget is approved for this year.",
                referenceId: null,
              },
            ]),
        ...s.flags
          .filter((f) => f.status === "Open")
          .slice(0, 3)
          .map((f) => ({
            code: "review-expense-flag",
            text: fa
              ? `بررسی هشدار هزینه دوره ${f.periodLabel}`
              : `Review the expense flag for ${f.periodLabel}.`,
            referenceId: f.id,
          })),
        ...x.reminders
          .filter((b) => b.status === "Draft")
          .map((b) => ({
            code: "approve-reminders",
            text: fa
              ? `تأیید یادآوری ${b.items.length} واحد`
              : `Approve reminders to ${b.items.length} lots.`,
            referenceId: b.id,
          })),
      ];
      return ok(res, {
        origin: "Deterministic",
        schemeId: s.id,
        schemeTitle: s.title,
        language: fa ? "fa" : "en",
        currency: s.market.currency,
        asOf,
        meetingDate: q.get("meetingDate") || null,
        generatedAtUtc: nowUtc(),
        health: financialHealth(s, lang),
        budgetVsActual: result.summary ?? null,
        committee: x.officeHolders
          .filter((o) => !o.termEnd || o.termEnd >= asOf)
          .map((o) => ({ ...o, isCurrent: true })),
        decisionsRequired: decisions,
        disclaimer: financialHealth(s, lang).disclaimer,
        rightToLeft: fa,
      });
    }

    // --- reminders
    if (rest === "arrears/reminders" && m === "GET") {
      const status = q.get("status");
      return ok(
        res,
        x.reminders
          .filter((b) => !status || b.status === status)
          .slice()
          .reverse()
          .map(batchResult),
      );
    }
    if (rest === "arrears/reminders" && m === "POST") {
      const denied = need("ManageFinancials");
      if (denied) return denied;
      const body = await readJson(req);
      const minimumOverdue = Number(body.minimumOverdue ?? 0);
      const minimumDaysOverdue = Number(body.minimumDaysOverdue ?? 30);
      if (!(minimumOverdue >= 0))
        return bad(res, 440001, "The minimum overdue cannot be negative.");
      if (!(minimumDaysOverdue >= 0 && minimumDaysOverdue <= 3650))
        return bad(res, 440001, "Days overdue must be between 0 and 3650.");
      const batch = draftReminders(s, x, {
        asOf: body.asOf,
        minimumOverdue,
        minimumDaysOverdue,
        includePaymentPlans: Boolean(body.includePaymentPlans),
        note: body.note,
        createdBy: user,
        lang,
      });
      if (!batch)
        return bad(res, 440004, "No lots meet these conditions, so there is nothing to send.");
      x.reminders.push(batch);
      audit({
        schemeId: s.id,
        actorId: user,
        category: "Financial",
        action: "reminders.drafted",
        entityType: "ReminderBatch",
        entityId: batch.id,
        after: { Items: batch.items.length },
      });
      return created(res, batchResult(batch));
    }
    if ((match = /^arrears\/reminders\/([0-9a-f-]{36})(\/.*)?$/i.exec(rest))) {
      const batch = x.reminders.find((b) => b.id === match[1]);
      if (!batch) return missing(res, "ReminderBatch", "Reminder batch not found.");
      const sub = match[2] ?? "";
      if (!sub && m === "GET") return ok(res, batchResult(batch));
      if (m !== "POST") return undefined;
      if (batch.status !== "Draft")
        return bad(res, 440002, "This batch has already been reviewed.");
      const exclude = /^\/lots\/(\d+)\/exclude$/.exec(sub);
      if (exclude) {
        const denied = need("ManageFinancials");
        if (denied) return denied;
        batch.items = batch.items.filter((i) => i.lotId !== Number(exclude[1]));
        return ok(res, batchResult(batch));
      }
      if (sub === "/approve" || sub === "/reject") {
        const denied = need("ApproveReminders");
        if (denied) return denied;
        if (sub === "/approve") {
          if (batch.createdBy === user)
            return bad(res, 440003, "Someone other than the author must approve this batch.");
          batch.status = "Approved";
          for (const item of batch.items) {
            if (item.status === "Skipped") continue;
            item.status = "Sent";
            item.sentAtUtc = nowUtc();
          }
        } else {
          const body = await readJson(req);
          if (!String(body.reason ?? "").trim())
            return bad(res, 440005, "Give a reason for rejecting.");
          batch.status = "Rejected";
          batch.rejectionReason = body.reason.trim();
        }
        batch.reviewedBy = user;
        batch.reviewedAtUtc = nowUtc();
        audit({
          schemeId: s.id,
          actorId: user,
          category: "Approval",
          action: sub === "/approve" ? "reminders.approved" : "reminders.rejected",
          entityType: "ReminderBatch",
          entityId: batch.id,
          before: { Status: "Draft" },
          after: { Status: batch.status },
          reason: batch.rejectionReason,
        });
        return ok(res, batchResult(batch));
      }
    }

    // --- capital works: items carry their funding; sources and contribution impact
    if (rest === "capital-works/items" && m === "GET") {
      const all = q.get("includeClosed") === "true";
      return ok(
        res,
        s.works
          .filter((w) => all || !["Completed", "Cancelled"].includes(w.status))
          .map((w) => itemResult(s, w)),
      );
    }
    if (
      (match =
        /^capital-works\/items\/([0-9a-f-]{36})\/funding-sources(?:\/([0-9a-f-]{36}))?$/i.exec(
          rest,
        ))
    ) {
      const denied = need("ManageFinancials");
      if (denied) return denied;
      const item = s.works.find((w) => w.id === match[1]);
      if (!item) return missing(res, "CapitalWorkItem", "Capital works item not found.");
      const sources = x.fundingSources.get(item.id) ?? [];
      if (m === "POST" && !match[2]) {
        const body = await readJson(req);
        const sourceType = SOURCE_TYPES[Number(body.sourceType)];
        const amount = Number(body.amount);
        if (!sourceType) return bad(res, 360101, "Choose a funding source.");
        if (!(amount > 0) || round(s, amount) !== amount)
          return bad(res, 360101, "Enter an amount above zero.");
        if (sum(sources, (y) => y.amount) + amount > item.currentEstimate)
          return bad(
            res,
            360102,
            "Funding sources cannot add up to more than the current estimate.",
          );
        sources.push({
          id: randomUUID(),
          sourceType,
          amount,
          isConfirmed: Boolean(body.isConfirmed),
          note: body.note || null,
        });
        x.fundingSources.set(item.id, sources);
        return ok(res, itemResult(s, item));
      }
      if (m === "DELETE" && match[2]) {
        if (!sources.some((y) => y.id === match[2]))
          return missing(res, "CapitalWorkFundingSource", "Funding source not found.");
        x.fundingSources.set(
          item.id,
          sources.filter((y) => y.id !== match[2]),
        );
        return ok(res, itemResult(s, item));
      }
    }
    if (
      (match = /^capital-works\/scenarios\/([0-9a-f-]{36})\/contribution-impact$/i.exec(rest)) &&
      m === "GET"
    ) {
      const sc = s.scenarios.find((y) => y.id === match[1]);
      if (!sc) return missing(res, "FundingScenario", "Scenario not found.");
      return contributionImpact(s, sc, lang, res);
    }

    // --- AI documents and questions
    if (rest === "ai/document-extractions" && m === "GET") {
      const status = q.get("status");
      return ok(
        res,
        x.extractions
          .filter((e) => !status || e.status === status)
          .slice()
          .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc)),
      );
    }
    if (rest === "ai/document-extractions" && m === "POST") {
      const denied = need("ManageFinancials");
      if (denied) return denied;
      const { file } = parseMultipart(await readRaw(req), req.headers["content-type"]);
      if (!file || file.body.length === 0) return bad(res, 350003, "The file is empty.");
      if (file.body.subarray(0, 4).toString("latin1") !== "%PDF")
        return bad(res, 370104, "The file is not a PDF.");
      if (file.body.length > 10 * 1024 * 1024)
        return bad(res, 350002, "The file is larger than 10 MB.");
      const e = extraction(s, {
        fileName: file.filename || "invoice.pdf",
        supplierIndex: x.extractions.length + 1,
        amount: round(s, (600 + x.extractions.length * 137) * s.market.scale),
        date: addDays(s.asOf, -2),
        failed: /fail/i.test(file.filename ?? ""),
      });
      x.extractions.push(e);
      audit({
        schemeId: s.id,
        actorId: user,
        category: "Ai",
        action: "ai.document-extracted",
        entityType: "DocumentExtraction",
        entityId: e.id,
        after: { Status: e.status },
      });
      return created(res, e);
    }
    if ((match = /^ai\/document-extractions\/([0-9a-f-]{36})(\/accept|\/reject)?$/i.exec(rest))) {
      const e = x.extractions.find((y) => y.id === match[1]);
      if (!e) return missing(res, "DocumentExtraction", "Extraction not found.");
      if (!match[2] && m === "GET") return ok(res, e);
      if (match[2] && m === "POST") {
        const denied = need("ManageFinancials");
        if (denied) return denied;
        if (e.status !== "PendingReview")
          return bad(
            res,
            370102,
            "Only an extraction awaiting review can be accepted or rejected.",
          );
        const body = await readJson(req);
        if (match[2] === "/accept") {
          const amount = Number(body.amount);
          if (!(amount > 0) || round(s, amount) !== amount)
            return bad(res, 370101, "Enter an amount above zero.");
          if (!body.transactionDate) return bad(res, 370101, "A transaction date is required.");
          const period =
            s.periods.find(
              (p) => body.transactionDate >= p.start && body.transactionDate <= p.end,
            ) ?? s.periods[s.periods.length - 1];
          const record = {
            id: randomUUID(),
            schemeId: s.id,
            lotId: null,
            financialPeriodId: period.label,
            recordType: "Expense",
            direction: "Outflow",
            fund: FUNDS[Number(body.fund ?? 1)] ?? "Admin",
            amount,
            currency: s.market.currency,
            transactionDate: body.transactionDate,
            dueDate: body.dueDate || null,
            supplierId: body.supplierId || null,
            categoryId: body.categoryId || null,
            status: "Verified",
            sourceDocumentId: e.id,
            importBatchId: null,
            sourceRowNumber: null,
            externalReference: body.externalReference || null,
            description: body.description || null,
          };
          s.records.push(record);
          Object.assign(e, { status: "Accepted", financialRecordId: record.id });
        } else {
          e.status = "Rejected";
        }
        Object.assign(e, {
          reviewedBy: user,
          reviewedAtUtc: nowUtc(),
          reviewNote: body.note || null,
        });
        audit({
          schemeId: s.id,
          actorId: user,
          category: "Ai",
          action: match[2] === "/accept" ? "ai.extraction-accepted" : "ai.extraction-rejected",
          entityType: "DocumentExtraction",
          entityId: e.id,
          before: { Status: "PendingReview" },
          after: { Status: e.status },
        });
        return ok(res, e);
      }
    }
    if (rest === "ai/questions" && m === "POST") {
      const body = await readJson(req);
      const question = String(body.question ?? "").trim();
      if (!question || question.length > 500)
        return bad(res, 370105, "Ask a question of up to 500 characters.");
      return ok(res, answer(s, question, lang, user));
    }

    // --- onboarding
    if (rest === "onboarding/checklist" && m === "GET") return ok(res, onboarding(s, lang));

    return undefined;
  }

  // ---------------------------------------------------------------- back office

  const pilotAgreements = [];
  {
    const [au, ir] = [...schemes.values()];
    if (au)
      pilotAgreements.push(
        agreement(au, {
          status: "Active",
          pricePerLotMonthly: 4,
          isPaidPilot: true,
          startDate: "2026-07-01",
          plannedEndDate: "2026-12-31",
          baselineHoursPerMonth: 18,
          caseStudyConsent: true,
        }),
      );
    if (ir)
      pilotAgreements.push(
        agreement(ir, { status: "Prospect", pricePerLotMonthly: 150000, isPaidPilot: false }),
      );
  }
  function agreement(s, fields) {
    return {
      id: randomUUID(),
      schemeId: s.id,
      status: "Prospect",
      pricePerLotMonthly: 0,
      currency: s.market.currency,
      lotCount: s.lots.length,
      isPaidPilot: false,
      startDate: null,
      plannedEndDate: null,
      convertedOn: null,
      lostOn: null,
      lostReason: null,
      baselineHoursPerMonth: null,
      caseStudyConsent: false,
      notes: null,
      ...fields,
    };
  }
  const agreementResult = (a) => ({ ...a, monthlyValue: a.pricePerLotMonthly * a.lotCount });

  function validAgreement(res, body) {
    const price = Number(body.pricePerLotMonthly);
    if (!(price >= 0)) return bad(res, 460001, "The price per lot cannot be negative.");
    if (body.lotCount !== undefined && body.lotCount !== null && !(Number(body.lotCount) >= 0))
      return bad(res, 460001, "The lot count cannot be negative.");
    return null;
  }

  function metrics() {
    const byStatus = { Prospect: 0, Active: 0, Converted: 0, Lost: 0 };
    const mrr = {};
    const pipeline = {};
    const lostReasons = {};
    const days = [];
    for (const a of pilotAgreements.map(agreementResult)) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
      if (a.status === "Converted") {
        mrr[a.currency] = (mrr[a.currency] ?? 0) + a.monthlyValue;
        if (a.startDate && a.convertedOn) days.push(daysBetween(a.startDate, a.convertedOn));
      }
      if (["Prospect", "Active"].includes(a.status))
        pipeline[a.currency] = (pipeline[a.currency] ?? 0) + a.monthlyValue;
      if (a.status === "Lost" && a.lostReason)
        lostReasons[a.lostReason] = (lostReasons[a.lostReason] ?? 0) + 1;
    }
    const decided = byStatus.Converted + byStatus.Lost;
    return {
      byStatus,
      paidPilots: pilotAgreements.filter((a) => a.isPaidPilot).length,
      conversionRatePercent: decided
        ? Math.round((byStatus.Converted / decided) * 1000) / 10
        : null,
      averageDaysToConvert: days.length ? Math.round(sum(days) / days.length) : null,
      monthlyRecurringRevenue: mrr,
      pipeline,
      lostReasons,
    };
  }

  async function backofficeRoutes(req, res, path, q, user) {
    const m = req.method;
    let match;

    const orgs = await boOrganisationRoutes(req, res, path, q, user);
    if (orgs !== undefined) return orgs;

    if (path === "backoffice/audit-logs" && m === "GET") {
      const schemeId = Number(q.get("schemeId")) || null;
      const organisationId = Number(q.get("organisationId")) || null;
      const actorId = q.get("actorId");
      const entityType = q.get("entityType");
      const entityId = q.get("entityId");
      return filterAudit(
        res,
        q,
        auditLog.filter(
          (e) =>
            (!schemeId || e.schemeId === schemeId) &&
            (!organisationId || e.organisationId === organisationId) &&
            (!actorId || e.actorId === actorId) &&
            (!entityType || e.entityType.toLowerCase() === entityType.toLowerCase()) &&
            (!entityId || e.entityId === entityId),
        ),
      );
    }

    if (path === "backoffice/evidence/security" && m === "GET") {
      const to = q.get("toUtc") || nowUtc();
      const from = q.get("fromUtc") || new Date(Date.parse(to) - 90 * 86_400_000).toISOString();
      if (from > to) return bad(res, 410001, "The start must be before the end.");
      const byCategory = {};
      for (const e of auditLog)
        if (e.occurredAtUtc >= from && e.occurredAtUtc <= to)
          byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
      return ok(res, {
        generatedAtUtc: nowUtc(),
        fromUtc: from,
        toUtc: to,
        productVersion: governance.version,
        governanceChecksum: governance.checksum,
        organisations: organisations.length,
        schemes: schemes.size,
        accessDeniedEventsAllTime: accessDenied?.length ?? 0,
        auditEntriesByCategory: byCategory,
        controls: [
          ["Identity", "Phone sign-in with one-time codes", "Keycloak realm, OTP via SMS provider"],
          [
            "Session",
            "Tokens in HttpOnly cookies only",
            "BFF sets cookies; scripts cannot read them",
          ],
          [
            "Tenant isolation",
            "Every scheme request checks membership",
            "Refused requests are logged",
          ],
          ["Least privilege", "Five scheme roles with a permission matrix", "SchemePermissions"],
          ["Separation of duties", "Reminders need a second approver", "Self-approval is refused"],
          [
            "Audit",
            "Sensitive changes recorded with before and after",
            "Same transaction as the change",
          ],
          [
            "Financial integrity",
            "Records are versioned, never overwritten",
            "FinancialRecordVersion",
          ],
          ["AI control", "AI output needs human acceptance", "Model and prompt versions stored"],
          ["Privacy", "No contact details in demo data or telemetry", "Telemetry schema is strict"],
          ["Transport", "HTTPS only, HSTS, strict CSP", "Reverse proxy and app headers"],
        ].map(([area, control, evidence]) => ({ area, control, evidence })),
      });
    }

    if ((match = /^backoffice\/schemes\/(\d+)\/case-study$/.exec(path)) && m === "GET") {
      const s = schemes.get(Number(match[1]));
      if (!s) return missing(res, "Scheme", "Scheme not found.");
      const a = pilotAgreements.find((y) => y.schemeId === s.id);
      const confirmed = s.flags.filter((f) => f.status === "Confirmed");
      const publishable = Boolean(a?.caseStudyConsent);
      const hoursSaved = sum(s.feedback, (f) => f.hoursSavedEstimate ?? 0);
      return ok(res, {
        schemeId: s.id,
        displayName: publishable ? s.title : `${s.lots.length}-lot scheme (${s.jurisdictionCode})`,
        publishable,
        jurisdictionCode: s.jurisdictionCode,
        currency: s.market.currency,
        lots: s.lots.length,
        baselineHoursPerMonth: a?.baselineHoursPerMonth ?? null,
        hoursSavedReported: hoursSaved,
        hoursToFirstVerifiedDashboard: 26,
        anomaliesFound: s.flags.length,
        anomaliesConfirmed: confirmed.length,
        moneyFlaggedConfirmed: sum(confirmed, (f) => f.estimatedAnnualisedImpact),
        reportsGenerated: s.reports.length,
        pilotStatus: a?.status ?? null,
        paidPilot: Boolean(a?.isPaidPilot),
        statements: [
          `First verified dashboard 26 hours after onboarding.`,
          `${s.flags.length} spending anomalies found, ${confirmed.length} confirmed by the manager.`,
          `${s.reports.length} committee reports generated from verified data.`,
        ],
      });
    }

    if (path === "backoffice/pilot-agreements" && m === "GET") {
      const status = q.get("status");
      return ok(
        res,
        pilotAgreements.filter((a) => !status || a.status === status).map(agreementResult),
      );
    }
    if (path === "backoffice/pilot-agreements/metrics" && m === "GET") return ok(res, metrics());
    if ((match = /^backoffice\/schemes\/(\d+)\/pilot-agreement$/.exec(path)) && m === "POST") {
      const s = schemes.get(Number(match[1]));
      if (!s) return missing(res, "Scheme", "Scheme not found.");
      const body = await readJson(req);
      const invalid = validAgreement(res, body);
      if (invalid) return invalid;
      if (
        pilotAgreements.some(
          (a) => a.schemeId === s.id && ["Prospect", "Active"].includes(a.status),
        )
      )
        return bad(res, 460003, "This scheme already has an open pilot agreement.");
      const a = agreement(s, {
        pricePerLotMonthly: Number(body.pricePerLotMonthly),
        lotCount: body.lotCount ?? s.lots.length,
        isPaidPilot: Boolean(body.isPaidPilot),
        baselineHoursPerMonth: body.baselineHoursPerMonth ?? null,
        caseStudyConsent: Boolean(body.caseStudyConsent),
        notes: body.notes || null,
      });
      pilotAgreements.push(a);
      return created(res, agreementResult(a));
    }
    if ((match = /^backoffice\/pilot-agreements\/([0-9a-f-]{36})(\/transition)?$/i.exec(path))) {
      const a = pilotAgreements.find((y) => y.id === match[1]);
      if (!a) return missing(res, "PilotAgreement", "Pilot agreement not found.");
      const body = await readJson(req);
      if (!match[2] && m === "PUT") {
        if (a.status === "Lost") return bad(res, 460004, "A lost agreement cannot be changed.");
        const invalid = validAgreement(res, body);
        if (invalid) return invalid;
        Object.assign(a, {
          pricePerLotMonthly: Number(body.pricePerLotMonthly),
          lotCount: body.lotCount ?? a.lotCount,
          isPaidPilot: Boolean(body.isPaidPilot),
          baselineHoursPerMonth: body.baselineHoursPerMonth ?? null,
          caseStudyConsent: Boolean(body.caseStudyConsent),
          notes: body.notes || null,
        });
        return ok(res, agreementResult(a));
      }
      if (match[2] && m === "POST") {
        const transition = Number(body.transition);
        const date = body.date;
        if (!date) return bad(res, 460004, "A date is required.");
        if (transition === 1) {
          if (a.status !== "Prospect")
            return bad(res, 460004, "Only a prospect can start a pilot.");
          if (!body.plannedEndDate || body.plannedEndDate < date)
            return bad(res, 460004, "The planned end must be on or after the start.");
          Object.assign(a, {
            status: "Active",
            startDate: date,
            plannedEndDate: body.plannedEndDate,
          });
        } else if (transition === 2) {
          if (a.status !== "Active") return bad(res, 460004, "Only an active pilot can convert.");
          if (date < a.startDate) return bad(res, 460004, "Conversion cannot be before the start.");
          Object.assign(a, { status: "Converted", convertedOn: date });
        } else if (transition === 3) {
          if (!["Prospect", "Active"].includes(a.status))
            return bad(res, 460004, "Only an open agreement can be lost.");
          if (!String(body.reason ?? "").trim()) return bad(res, 460004, "Give a reason.");
          Object.assign(a, { status: "Lost", lostOn: date, lostReason: body.reason.trim() });
        } else {
          return bad(res, 460004, "Choose a valid transition.");
        }
        return ok(res, agreementResult(a));
      }
    }

    if (path === "backoffice/demo/investor-flow" && m === "POST") {
      const jurisdiction = (q.get("jurisdiction") || "AU-NSW").toUpperCase();
      if (!["AU-NSW", "IR"].includes(jurisdiction))
        return fail(res, 400, "300001", "Domain Error", ["This jurisdiction is not supported."]);
      const s = createScheme({
        title: jurisdiction === "IR" ? "برج نمایشی" : "Demo Gardens",
        address: jurisdiction === "IR" ? "خیابان نمونه، تهران" : "1 Demo Street, Sydney NSW 2000",
        jurisdictionCode: jurisdiction,
        seed: 1000 + schemes.size,
        demo: true,
      });
      const h = financialHealth(s, "en");
      const base = `/api/v1/schemes/${s.id}`;
      return created(res, {
        schemeId: s.id,
        jurisdictionCode: jurisdiction,
        currency: s.market.currency,
        steps: [
          [
            "Financial health at a glance",
            `${base}/financial-health`,
            `Admin fund ${Math.round(h.adminFund.balance)}`,
          ],
          ["Spending by category", `${base}/expenses/spend`, "Every figure drills down to records"],
          [
            "Unusual and duplicate spend",
            `${base}/expenses/flags`,
            `${s.flags.length} flags to review`,
          ],
          [
            "Who is behind",
            `${base}/arrears/risk-signals`,
            `${h.arrears.lotsInArrears} lots in arrears`,
          ],
          [
            "Capital works funding gap",
            `${base}/capital-works/scenarios`,
            h.capitalWorks.firstShortfallYear
              ? `Short from ${h.capitalWorks.firstShortfallYear}`
              : "No shortfall",
          ],
          ["Budget against actual", `${base}/budgets/vs-actual`, "Variance explained with records"],
          ["Ask a question", `${base}/ai/questions`, "Answers come from verified data"],
        ].map(([title, endpoint, highlight], i) => ({ order: i + 1, title, endpoint, highlight })),
      });
    }

    return undefined;
  }

  return { globalRoutes, schemeRoutes, backofficeRoutes, audit };
}
