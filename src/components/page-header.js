export default function PageHeader({
  description,
  descriptionClassName = "",
  headingId,
  title,
}) {
  return (
    <div className="page-header">
      <h1
        className="text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-[2.15rem] dark:text-white"
        id={headingId}
      >
        {title}
      </h1>
      <p
        className={`mt-2 text-[0.95rem] leading-6 text-slate-600 dark:text-slate-300 ${descriptionClassName}`}
      >
        {description}
      </p>
    </div>
  );
}
