import { z } from "zod";

export const LAB_ROW_FILTER_ALL = "all";
export const LAB_ROW_FILTERS = Object.freeze({
  all: null,
  accepted: "ACCEPTED",
  rejected: "REJECTED",
  duplicate: "DUPLICATE",
});

export const labImportRouteParamsSchema = z
  .object({ importId: z.uuid("invalid_id") })
  .strict();

export const parseLabRowFilter = (query = {}) => {
  const value = typeof query.status === "string" ? query.status : "";
  return Object.hasOwn(LAB_ROW_FILTERS, value) ? value : LAB_ROW_FILTER_ALL;
};

export const buildLabImportDetailHref = (
  importId,
  filter = LAB_ROW_FILTER_ALL,
) =>
  filter === LAB_ROW_FILTER_ALL
    ? `/lab-uploads/${encodeURIComponent(importId)}`
    : `/lab-uploads/${encodeURIComponent(importId)}?status=${filter}`;
