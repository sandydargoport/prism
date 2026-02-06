'use client';

interface PrismIconProps {
  className?: string;
  size?: number;
}

export function PrismIcon({ className, size = 24 }: PrismIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Icosidodecahedron-inspired gem shape with facets */}
      {/* Main center facet */}
      <path
        d="M12 4L7 9L12 14L17 9L12 4Z"
        className="fill-slate-600 dark:fill-slate-200 stroke-slate-800 dark:stroke-white"
        strokeWidth="0.5"
      />
      {/* Left facet */}
      <path
        d="M7 9L4 13L9 18L12 14L7 9Z"
        className="fill-slate-700 dark:fill-slate-300 stroke-slate-800 dark:stroke-white"
        strokeWidth="0.5"
      />
      {/* Right facet */}
      <path
        d="M17 9L20 13L15 18L12 14L17 9Z"
        className="fill-slate-500 dark:fill-slate-100 stroke-slate-800 dark:stroke-white"
        strokeWidth="0.5"
      />
      {/* Bottom facet */}
      <path
        d="M12 14L9 18L12 21L15 18L12 14Z"
        className="fill-slate-600 dark:fill-slate-200 stroke-slate-800 dark:stroke-white"
        strokeWidth="0.5"
      />
      {/* Light beam entering */}
      <path
        d="M1 7L6 10"
        className="stroke-slate-500 dark:stroke-white/60"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Rainbow spectrum rays */}
      <path d="M18 10L23 6" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19 12L23 9" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19.5 14L23 12" stroke="#EAB308" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19 16L23 15" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 18L22 18" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 19.5L21 21" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
