import { pct, signClass } from "@/lib/format";

/** Large monospaced return figure with sign colour and optional change flash. */
export function ReturnFigure({
  ratio,
  size = "lg",
  flash,
  digits = 1,
}: {
  ratio: number | null;
  size?: "sm" | "md" | "lg";
  flash?: "up" | "down";
  digits?: number;
}) {
  const sizeClass =
    size === "lg"
      ? "text-2xl sm:text-3xl"
      : size === "md"
        ? "text-lg"
        : "text-sm";
  const flashClass =
    flash === "up" ? "flash-gain" : flash === "down" ? "flash-loss" : "";
  return (
    <span
      className={`tnum font-medium ${sizeClass} ${signClass(ratio)} ${flashClass} inline-block rounded px-1`}
    >
      {pct(ratio, digits)}
    </span>
  );
}
