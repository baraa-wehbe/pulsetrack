import { createHash } from "node:crypto";
import path from "node:path";

import { LAB_CSV_REQUIRED_HEADERS } from "@/server/labs/template";

const ALLOWED_CSV_TYPES = new Set([
  "",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
]);

export class LabUploadValidationError extends Error {
  constructor(code) {
    super("Invalid lab CSV upload.");
    this.name = "LabUploadValidationError";
    this.code = code;
  }
}

const safeFileName = (value) => path.basename(value).trim();

export const validateLabCsvFile = async (file, maximumBytes) => {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new LabUploadValidationError("FILE_REQUIRED");
  }

  const originalFileName = safeFileName(file.name ?? "");
  if (
    !originalFileName ||
    originalFileName.length > 255 ||
    !originalFileName.toLowerCase().endsWith(".csv") ||
    !ALLOWED_CSV_TYPES.has((file.type ?? "").toLowerCase())
  ) {
    throw new LabUploadValidationError("CSV_REQUIRED");
  }
  if (!Number.isInteger(file.size) || file.size === 0) {
    throw new LabUploadValidationError("FILE_EMPTY");
  }
  if (file.size > maximumBytes) {
    throw new LabUploadValidationError("FILE_TOO_LARGE");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) {
    throw new LabUploadValidationError("FILE_EMPTY");
  }
  if (bytes.length > maximumBytes) {
    throw new LabUploadValidationError("FILE_TOO_LARGE");
  }

  const firstLineEnd = bytes.indexOf(0x0a);
  const headerBytes =
    firstLineEnd === -1 ? bytes : bytes.subarray(0, firstLineEnd);
  const header = headerBytes.toString("utf8").replace(/\r$/, "");
  if (header !== LAB_CSV_REQUIRED_HEADERS.join(",")) {
    throw new LabUploadValidationError("INVALID_HEADERS");
  }

  return {
    originalFileName,
    fileSha256: createHash("sha256").update(bytes).digest("hex"),
  };
};
