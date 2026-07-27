export default function PageHeader({
  description,
  descriptionClassName = "",
  headingId,
  title,
}) {
  return (
    <div>
      <h1
        className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
        id={headingId}
      >
        {title}
      </h1>
      <p
        className={`mt-2 text-slate-600 dark:text-slate-300 ${descriptionClassName}`}
      >
        {description}
      </p>
    </div>
  );
}
