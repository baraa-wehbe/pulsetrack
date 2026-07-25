import AppNavigation from "@/components/app-navigation";

export default function AuthenticatedShell({
  children,
  clinician,
  direction,
  language,
  messages,
  theme,
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <a
        className="fixed start-4 top-3 z-[100] -translate-y-20 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-lg transition focus:translate-y-0 focus:outline-2 focus:outline-offset-2 focus:outline-teal-300"
        href="#main-content"
      >
        {messages.skipToContent}
      </a>
      <AppNavigation
        clinician={clinician}
        direction={direction}
        language={language}
        messages={messages}
        theme={theme}
      />
      <main
        className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
