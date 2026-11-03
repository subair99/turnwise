// Deterministic reading of a member's cap. The model extracts; this decides what is enforceable.
//   1. An absolute "no" ("I won't pay anything", "no discount", "zero") -> cap $0, whatever else the text says.
//   2. Otherwise the LOWEST amount the member wrote ("$2", "150 cents", "two dollars").
//   3. Neither -> not enforceable; ask the member for an amount.
const WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
};
const DIGITS = /(?:\$|usd\s?)\s?(\d+(?:[.,]\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s?(dollars?|bucks?|usd|cents?)\b/gi;
const WORDED = new RegExp(`\\b(${Object.keys(WORDS).join("|")})\\s+(dollars?|bucks?|cents?)\\b`, "gi");
const REFUSAL =
  /\b(won'?t|will not|wont|not|never|don'?t|do not|no)\b[^.$\d]{0,25}\b(pay|paying|bid|bidding|spend|spending|discount)\b(?![^.]{0,25}\b(more|over|above|beyond|than|unless)\b)|\b(nothing|zero|no discount|\$0(?:\.00)?|0 cents)\b/i;

export function statedAmounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(DIGITS)) {
    const raw = (m[1] ?? m[2] ?? "").replace(",", ".");
    const cents = /cents?/i.test(m[3] ?? "");
    const v = Number(raw);
    if (Number.isFinite(v)) out.push(Math.round(cents ? v : v * 100));
  }
  for (const m of text.matchAll(WORDED)) {
    const v = WORDS[m[1]!.toLowerCase()]!;
    out.push(/cents?/i.test(m[2]!) ? v : v * 100);
  }
  return out;
}

export function capFromText(text: string): { stated: boolean; ceiling: number | null; rule: "refusal" | "amount" | "none" } {
  if (REFUSAL.test(text)) return { stated: true, ceiling: 0, rule: "refusal" };
  const amounts = statedAmounts(text);
  if (amounts.length) return { stated: true, ceiling: Math.min(...amounts), rule: "amount" };
  return { stated: false, ceiling: null, rule: "none" };
}
