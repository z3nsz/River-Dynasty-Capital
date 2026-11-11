/** Fallback when WebGL is unavailable: the three waves of the mark, drawn once. */
export function StaticWaves() {
  const wave = (y: number) =>
    `M40,${y} c 52,-56 105,-56 158,0 c 52,56 105,56 158,0 c 52,-56 105,-56 158,0 c 52,56 105,56 158,0`;
  return (
    <svg viewBox="0 0 712 400" preserveAspectRatio="xMidYMid meet" className="rdc-static-waves">
      <defs>
        <linearGradient id="rdcFallbackGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2E7FB8" />
          <stop offset="1" stopColor="#17B0A0" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#rdcFallbackGrad)" strokeWidth="3" strokeLinecap="round" opacity="0.55">
        <path d={wave(150)} />
        <path d={wave(210)} />
        <path d={wave(270)} />
      </g>
    </svg>
  );
}
