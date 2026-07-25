export const toDateOnly = (date) => date.toISOString().slice(0, 10);

export const toSafePatient = (patient) => ({
  id: patient.id,
  mrn: patient.mrn,
  firstName: patient.firstName,
  lastName: patient.lastName,
  dateOfBirth: toDateOnly(patient.dateOfBirth),
  sex: patient.sex,
  email: patient.email,
  phone: patient.phone,
  archivedAt: patient.archivedAt?.toISOString() ?? null,
  createdAt: patient.createdAt.toISOString(),
  updatedAt: patient.updatedAt.toISOString(),
});

export const toSafePatientListItem = (patient) => ({
  id: patient.id,
  mrn: patient.mrn,
  firstName: patient.firstName,
  lastName: patient.lastName,
  dateOfBirth: toDateOnly(patient.dateOfBirth),
  sex: patient.sex,
  email: patient.email,
  phone: patient.phone,
});

export const PATIENT_SAFE_SELECT = Object.freeze({
  id: true,
  mrn: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  sex: true,
  email: true,
  phone: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const PATIENT_LIST_SELECT = Object.freeze({
  id: true,
  mrn: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  sex: true,
  email: true,
  phone: true,
});
