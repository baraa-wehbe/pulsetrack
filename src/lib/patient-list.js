import {
  PATIENT_LIST_ALL,
  PATIENT_LIST_DEFAULTS,
  patientListQuerySchema,
} from "@/lib/patient-validation";

const UNKNOWN_BADGE = Object.freeze({
  translationKey: "badgeUnknown",
  descriptionKey: "badgeUnknownDescription",
  variant: "neutral",
});

export const PATIENT_BADGE_MAPPINGS = Object.freeze({
  origin: Object.freeze({
    LOCAL: Object.freeze({
      translationKey: "originLocal",
      descriptionKey: "originLocalDescription",
      variant: "teal",
    }),
    FHIR: Object.freeze({
      translationKey: "originFhir",
      descriptionKey: "originFhirDescription",
      variant: "blue",
    }),
  }),
  ownership: Object.freeze({
    NONE: Object.freeze({
      translationKey: "ownershipNone",
      descriptionKey: "ownershipNoneDescription",
      variant: "neutral",
    }),
    CANDIDATE_OWNED: Object.freeze({
      translationKey: "ownershipClinic",
      descriptionKey: "ownershipClinicDescription",
      variant: "teal",
    }),
    EXTERNAL_READ_ONLY: Object.freeze({
      translationKey: "ownershipExternal",
      descriptionKey: "ownershipExternalDescription",
      variant: "amber",
    }),
  }),
  syncStatus: Object.freeze({
    NOT_SYNCED: Object.freeze({
      translationKey: "syncNotSynced",
      descriptionKey: "syncNotSyncedDescription",
      variant: "neutral",
    }),
    PENDING: Object.freeze({
      translationKey: "syncPending",
      descriptionKey: "syncPendingDescription",
      variant: "amber",
    }),
    SYNCED: Object.freeze({
      translationKey: "syncSynced",
      descriptionKey: "syncSyncedDescription",
      variant: "green",
    }),
    FAILED: Object.freeze({
      translationKey: "syncFailed",
      descriptionKey: "syncFailedDescription",
      variant: "red",
    }),
  }),
});

export const getPatientBadge = (kind, value) =>
  PATIENT_BADGE_MAPPINGS[kind]?.[value] ?? UNKNOWN_BADGE;

export const buildPatientListHref = (query, overrides = {}) => {
  const resolved = { ...PATIENT_LIST_DEFAULTS, ...query, ...overrides };
  const parameters = new URLSearchParams();

  if (resolved.search) parameters.set("search", resolved.search);
  if (resolved.origin !== PATIENT_LIST_ALL) {
    parameters.set("origin", resolved.origin);
  }
  if (resolved.ownership !== PATIENT_LIST_ALL) {
    parameters.set("ownership", resolved.ownership);
  }
  if (resolved.syncStatus !== PATIENT_LIST_ALL) {
    parameters.set("syncStatus", resolved.syncStatus);
  }
  if (resolved.page !== 1) parameters.set("page", String(resolved.page));
  if (resolved.pageSize !== PATIENT_LIST_DEFAULTS.pageSize) {
    parameters.set("pageSize", String(resolved.pageSize));
  }

  const serialized = parameters.toString();
  return serialized ? `/patients?${serialized}` : "/patients";
};

export const buildPatientDetailHref = (mrn, query) => {
  const returnTo = buildPatientListHref(query);
  const parameters = new URLSearchParams({ returnTo });

  return `/patients/${encodeURIComponent(mrn)}?${parameters}`;
};

export const resolvePatientListReturnPath = (value) => {
  if (typeof value !== "string" || value.length > 500) {
    return "/patients";
  }

  try {
    const url = new URL(value, "https://pulsetrack.local");

    if (
      url.origin !== "https://pulsetrack.local" ||
      url.pathname !== "/patients" ||
      url.hash
    ) {
      return "/patients";
    }

    const parsed = patientListQuerySchema.safeParse(
      Object.fromEntries(url.searchParams),
    );

    return parsed.success ? buildPatientListHref(parsed.data) : "/patients";
  } catch {
    return "/patients";
  }
};
