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
    <div className="app-shell">
      <a
        className="control-pill fixed start-4 top-3 z-[100] -translate-y-20 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-lg transition focus:translate-y-0 focus:outline-2 focus:outline-offset-2 focus:outline-teal-300"
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
        className="app-main mx-auto w-full max-w-screen-2xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-11"
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
