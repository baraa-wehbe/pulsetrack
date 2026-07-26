export const LAB_IMPORT_HISTORY_SELECT = Object.freeze({
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

const toSafeLabImport = (labImport) => ({
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
});

export const createLabImport = async (prismaClient, clinicianId, metadata) => {
  const created = await prismaClient.labImport.create({
    data: {
      uploadedById: clinicianId,
      originalFileName: metadata.originalFileName,
      fileSha256: metadata.fileSha256,
      status: "PROCESSING",
    },
    select: LAB_IMPORT_HISTORY_SELECT,
  });

  return toSafeLabImport(created);
};

export const listLabImports = async (prismaClient, clinicianId) => {
  const imports = await prismaClient.labImport.findMany({
    where: { uploadedById: clinicianId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: LAB_IMPORT_HISTORY_SELECT,
  });

  return imports.map(toSafeLabImport);
};
