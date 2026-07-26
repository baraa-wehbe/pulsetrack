import { readFile } from "node:fs/promises";

export const LAB_CSV_TEMPLATE_FILENAME = "lab-results-template.csv";
export const LAB_CSV_REQUIRED_HEADERS = Object.freeze([
  "mrn",
  "collected_date",
  "test_code",
  "test_name",
  "value",
  "unit",
  "ref_low",
  "ref_high",
]);

export const readLabCsvTemplate = () =>
  readFile(new URL("./lab-results-template.csv", import.meta.url));
