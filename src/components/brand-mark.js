export default function BrandMark({ className = "" }) {
  return (
    <span className={`brand-mark ${className}`} aria-hidden="true">
      <svg className="size-5" fill="none" viewBox="0 0 24 24">
        <path
          d="M3 12h3.2l1.7-4.1 3.2 8.2 2.2-5.2 1.2 2.1H21"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </span>
  );
}
