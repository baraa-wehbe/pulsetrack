"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import LogoutButton from "@/components/logout-button";
import PreferenceControls from "@/components/preference-controls";
import {
  DASHBOARD_NAVIGATION,
  isDashboardRoute,
  isRouteActive,
  PRIMARY_NAVIGATION,
} from "@/lib/navigation";

const desktopLinkClass = (active) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${
    active
      ? "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
  }`;

const MobileLink = ({ active, children, href, onSelect }) => (
  <Link
    aria-current={active ? "page" : undefined}
    className={`block rounded-lg border-s-4 px-4 py-3 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${
      active
        ? "border-teal-600 bg-teal-50 text-teal-900 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-100"
        : "border-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
    }`}
    href={href}
    onClick={onSelect}
  >
    {children}
  </Link>
);

const ClinicianIdentity = ({ clinician, messages }) => (
  <div className="min-w-0">
    <p className="text-xs text-slate-500 dark:text-slate-400">
      {messages.signedInAs}
    </p>
    <p className="max-w-48 truncate text-sm font-semibold text-slate-900 dark:text-white">
      {clinician.fullName}
    </p>
    <p
      className="max-w-48 truncate text-xs text-slate-500 dark:text-slate-400"
      dir="ltr"
    >
      {clinician.email}
    </p>
  </div>
);

const MenuIcon = () => (
  <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
    <path
      d="M4 7h16M4 12h16M4 17h16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
    />
  </svg>
);

const CloseIcon = () => (
  <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
    <path
      d="m6 6 12 12M18 6 6 18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
    />
  </svg>
);

const ChevronIcon = () => (
  <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
    <path
      d="m7 10 5 5 5-5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

export default function AppNavigation({
  clinician,
  direction,
  language,
  messages,
  theme,
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const dashboardActive = isDashboardRoute(pathname);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex min-h-16 max-w-screen-2xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          className="shrink-0 rounded-md text-lg font-bold tracking-tight text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600 dark:text-teal-300"
          href="/"
        >
          {messages.brand}
        </Link>

        <nav
          aria-label={messages.primaryNavigation}
          className="hidden min-w-0 items-center gap-1 lg:flex"
        >
          {PRIMARY_NAVIGATION.map(({ href, labelKey }) => {
            const active = isRouteActive(pathname, href);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={desktopLinkClass(active)}
                href={href}
                key={href}
              >
                {messages[labelKey]}
              </Link>
            );
          })}

          <DropdownMenu.Root dir={direction}>
            <DropdownMenu.Trigger
              aria-label={messages.openDashboardMenu}
              className={`${desktopLinkClass(dashboardActive)} flex items-center gap-1`}
            >
              {messages.dashboard}
              <ChevronIcon />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                className="z-50 min-w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900"
                sideOffset={8}
              >
                {DASHBOARD_NAVIGATION.map(({ href, labelKey }) => {
                  const active = isRouteActive(pathname, href);

                  return (
                    <DropdownMenu.Item asChild key={href}>
                      <Link
                        aria-current={active ? "page" : undefined}
                        className={`block cursor-pointer rounded-lg px-3 py-2.5 text-sm outline-none focus:bg-teal-50 focus:text-teal-900 dark:focus:bg-teal-950 dark:focus:text-teal-100 ${
                          active
                            ? "bg-teal-50 font-semibold text-teal-900 dark:bg-teal-950 dark:text-teal-100"
                            : "text-slate-700 dark:text-slate-200"
                        }`}
                        href={href}
                      >
                        {messages[labelKey]}
                      </Link>
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </nav>

        <div className="ms-auto hidden min-w-0 items-center gap-3 lg:flex">
          <PreferenceControls
            language={language}
            messages={messages}
            theme={theme}
          />
          <div
            aria-hidden="true"
            className="h-8 w-px bg-slate-200 dark:bg-slate-700"
          />
          <ClinicianIdentity clinician={clinician} messages={messages} />
          <LogoutButton messages={messages} />
        </div>

        <Dialog.Root onOpenChange={setMobileOpen} open={mobileOpen}>
          <Dialog.Trigger asChild>
            <button
              aria-label={messages.openNavigation}
              className="ms-auto inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
              type="button"
            >
              <MenuIcon />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm lg:hidden" />
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-y-0 end-0 z-50 flex w-[min(90vw,24rem)] flex-col overflow-y-auto border-s border-slate-200 bg-white p-5 shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-950 lg:hidden"
              dir={direction}
            >
              <div className="flex items-center justify-between gap-4">
                <Dialog.Title className="text-lg font-bold text-teal-800 dark:text-teal-300">
                  {messages.brand}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    aria-label={messages.closeNavigation}
                    className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:text-slate-300 dark:hover:bg-slate-800"
                    type="button"
                  >
                    <CloseIcon />
                  </button>
                </Dialog.Close>
              </div>

              <nav
                aria-label={messages.primaryNavigation}
                className="mt-6 space-y-1"
              >
                {PRIMARY_NAVIGATION.map(({ href, labelKey }) => (
                  <MobileLink
                    active={isRouteActive(pathname, href)}
                    href={href}
                    key={href}
                    onSelect={() => setMobileOpen(false)}
                  >
                    {messages[labelKey]}
                  </MobileLink>
                ))}
                <p className="px-4 pb-1 pt-5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {messages.dashboard}
                </p>
                {DASHBOARD_NAVIGATION.map(({ href, labelKey }) => (
                  <MobileLink
                    active={isRouteActive(pathname, href)}
                    href={href}
                    key={href}
                    onSelect={() => setMobileOpen(false)}
                  >
                    {messages[labelKey]}
                  </MobileLink>
                ))}
              </nav>

              <div className="mt-auto space-y-5 border-t border-slate-200 pt-6 dark:border-slate-800">
                <ClinicianIdentity clinician={clinician} messages={messages} />
                <PreferenceControls
                  language={language}
                  messages={messages}
                  theme={theme}
                />
                <LogoutButton className="w-full" messages={messages} />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}
