import { useId } from "react";

/**
 * River Dynasty Capital mark — rounded tile, blue→teal gradient, three river lines.
 *
 * Each instance gets its own gradient id: with a shared id every copy resolves
 * to the first one in the document, and if that copy is hidden (display: none)
 * the others lose their fill.
 */
export function Logo({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const gradId = `rdcRiverGrad-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="14 14 132 132"
      className={className}
      role="img"
      aria-label="River Dynasty Capital"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2E7FB8" />
          <stop offset="1" stopColor="#17B0A0" />
        </linearGradient>
      </defs>
      <rect x="20" y="20" width="120" height="120" rx="28" fill={`url(#${gradId})`} />
      <g fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round">
        <path d="M42,62 c 8.4,-9 16.9,-9 25.3,0 c 8.4,9 16.9,9 25.3,0 c 8.4,-9 16.9,-9 25.3,0" />
        <path d="M42,80 c 8.4,-9 16.9,-9 25.3,0 c 8.4,9 16.9,9 25.3,0 c 8.4,-9 16.9,-9 25.3,0" />
        <path d="M42,98 c 8.4,-9 16.9,-9 25.3,0 c 8.4,9 16.9,9 25.3,0 c 8.4,-9 16.9,-9 25.3,0" />
      </g>
    </svg>
  );
}
