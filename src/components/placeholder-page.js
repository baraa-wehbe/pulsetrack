export default function PlaceholderPage({ description, eyebrow, title }) {
  return (
    <section
      aria-labelledby="page-heading"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900"
    >
      <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
        {eyebrow}
      </p>
      <h1
        className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
        id="page-heading"
      >
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
        {description}
      </p>
    </section>
  );
}
