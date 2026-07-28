import { lazy, Suspense } from "react";

import DashboardRouteSkeleton from "@/components/dashboard-route-skeleton";

const ClinicDashboardRoute = lazy(() => import("./dashboard-route"));

export const metadata = {
  title: "Clinic Dashboard | PulseTrack",
};

export const dynamic = "force-dynamic";

export default function ClinicDashboardPage({ searchParams }) {
  return (
    <Suspense fallback={<DashboardRouteSkeleton chartCards={3} />}>
      <ClinicDashboardRoute searchParams={searchParams} />
    </Suspense>
  );
}
