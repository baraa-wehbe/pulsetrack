export const PRIMARY_NAVIGATION = Object.freeze([
  { href: "/patients", labelKey: "patients" },
  { href: "/lab-uploads", labelKey: "labUploads" },
]);

export const DASHBOARD_NAVIGATION = Object.freeze([
  { href: "/dashboard/clinic", labelKey: "clinicDashboard" },
  { href: "/dashboard/patient", labelKey: "patientDashboard" },
]);

export const isRouteActive = (pathname, href) =>
  pathname === href || pathname.startsWith(`${href}/`);

export const isDashboardRoute = (pathname) =>
  DASHBOARD_NAVIGATION.some(({ href }) => isRouteActive(pathname, href));
