// All money is handled as integer cents. Never use floats for amounts.
export type Cents = number;

export function toCents(value: string | number): Cents {
  const s = typeof value === "number" ? value.toFixed(2) : value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Invalid amount: ${value}`);
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

// PayPal APIs take amounts as strings like "100.00".
export function toValue(cents: Cents): string {
  assertCents(cents);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function assertCents(cents: Cents): void {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`Not a non-negative integer cent amount: ${cents}`);
}

// Splits a total into n parts that differ by at most one cent and always sum to the total.
// The first (total % n) parts get the extra cent, so results are deterministic.
export function splitEvenly(total: Cents, parts: number): Cents[] {
  assertCents(total);
  if (!Number.isInteger(parts) || parts <= 0) throw new Error(`Invalid number of parts: ${parts}`);
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function formatMoney(cents: Cents, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
