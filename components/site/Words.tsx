import type { CSSProperties, ReactNode } from "react";

/**
 * A heading split into words, each in its own clipping box, so the words can
 * rise into view one after another (see "word reveal" in site.css). Pass
 * `text` to split on spaces, or `words` to supply pre-built pieces.
 */
export function Words({ text, words }: { text?: string; words?: ReactNode[] }) {
  const items: ReactNode[] = words ?? (text ?? "").split(" ");
  return (
    <>
      {items.map((w, i) => (
        <span key={i}>
          <span className="rdc-w">
            <span style={{ "--i": i } as CSSProperties}>{w}</span>
          </span>
          {i < items.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}
