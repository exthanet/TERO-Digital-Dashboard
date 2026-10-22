// One wording everywhere a number is set against normal (value ÷ the median of
// its kind): "ดีกว่าปกติ 2.3 เท่า" / "ต่ำกว่าปกติ 60%" (got 40% of normal), and
// "ใกล้เคียงปกติ" within 5% either side.
//
// Relative imports only: tests run this file directly with Node.

/** Within this share of normal either side it reads as normal. */
const NEAR = 0.05;

export function vsNormal(index: number): string {
  if (index >= 1 + NEAR) return `ดีกว่าปกติ ${index.toFixed(1)} เท่า`;
  if (index <= 1 - NEAR) return `ต่ำกว่าปกติ ${Math.round((1 - index) * 100)}%`;
  return "ใกล้เคียงปกติ";
}

/** "up" / "down" / "" for colouring, with the same 5% band. */
export function vsNormalTone(index: number): "up" | "down" | "" {
  return index >= 1 + NEAR ? "up" : index <= 1 - NEAR ? "down" : "";
}
