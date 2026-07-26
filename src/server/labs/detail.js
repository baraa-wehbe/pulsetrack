import {
  getLabRowErrorPresentation,
  LAB_ROW_ERROR_CODES,
} from "@/lib/lab-row-errors";
import { LAB_ROW_FILTERS } from "@/lib/lab-import-detail";

const IMPORT_DETAIL_SELECT = Object.freeze({
  id: true,
  originalFileName: true,
  status: true,
  totalRows: true,
  acceptedRows: true,
  rejectedRows: true,
  duplicateRows: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
});

const safeString = (value) =>
  typeof value === "string" ? value.slice(0, 320) : null;

const toSafeNormalizedData = (value) => ({
  mrn: safeString(value?.mrn),
  collectedDate: safeString(value?.collectedDate),
  testCode: safeString(value?.testCode),
  value: safeString(value?.value),
  unit: safeString(value?.unit),
  refLow: safeString(value?.refLow),
  refHigh: safeString(value?.refHigh),
});

const toSafeRow = (row) => {
  const normalized = toSafeNormalizedData(row.normalizedData);

  return {
    rowNumber: row.rowNumber,
    status: row.status,
    normalized,
    errors: Array.isArray(row.validationErrors)
      ? row.validationErrors.map((error) => {
          const presentation = getLabRowErrorPresentation(error);
          if (
            presentation.code === LAB_ROW_ERROR_CODES.MISSING_REQUIRED_FIELD &&
            !presentation.field
          ) {
            presentation.field = [
              ["mrn", normalized.mrn],
              ["collected_date", normalized.collectedDate],
              ["test_code", normalized.testCode],
              ["value", normalized.value],
            ].find(([, value]) => !value)?.[0];
          }
          return presentation;
        })
      : [],
  };
};

const toSafeDetail = (labImport) => ({
  id: labImport.id,
  originalFileName: labImport.originalFileName,
  status: labImport.status,
  totalRows: labImport.totalRows,
  acceptedRows: labImport.acceptedRows,
  rejectedRows: labImport.rejectedRows,
  duplicateRows: labImport.duplicateRows,
  startedAt: labImport.startedAt.toISOString(),
  completedAt: labImport.completedAt?.toISOString() ?? null,
  createdAt: labImport.createdAt.toISOString(),
  rows: labImport.rows.map(toSafeRow),
});

export const getLabImportDetail = async (
  prismaClient,
  clinicianId,
  importId,
  filter = "all",
) => {
  const status = LAB_ROW_FILTERS[filter] ?? null;
  const labImport = await prismaClient.labImport.findFirst({
    where: { id: importId, uploadedById: clinicianId },
    select: {
      ...IMPORT_DETAIL_SELECT,
      rows: {
        where: status ? { status } : undefined,
        orderBy: [{ rowNumber: "asc" }, { id: "asc" }],
        select: {
          rowNumber: true,
          status: true,
          normalizedData: true,
          validationErrors: true,
        },
      },
    },
  });

  return labImport ? toSafeDetail(labImport) : null;
};
