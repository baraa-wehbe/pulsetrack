export const toPublicClinician = (clinician) => ({
  id: clinician.id,
  email: clinician.email,
  fullName: clinician.fullName,
  preferredLocale: clinician.preferredLocale,
  themePreference: clinician.themePreference,
});
