export default function InlineSpinner({ className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`clinical-inline-spinner ${className}`}
    />
  );
}
