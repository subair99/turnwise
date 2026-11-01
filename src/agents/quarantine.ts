// Member chat and voice text is DATA, never instructions. Flag attempts to steer the agents.
const PATTERNS: [RegExp, string][] = [
  [/\b(ignore|disregard|forget)\b.{0,40}\b(rules?|instructions?|charter|mandate|previous|above)\b/i, "instruction override"],
  [/\b(system|developer)\s*(prompt|message|mode)\b/i, "prompt probing"],
  [/\byou are now\b|\bact as\b|\bpretend to be\b/i, "role change"],
  [/\b(pay|send|transfer|release)\b.{0,30}\b(me|my account)\b.{0,30}\b(now|immediately|first|the pot|everything)\b/i, "direct payout demand"],
  [/\b(override|bypass|skip)\b.{0,30}\b(gate|policy|check|cap|limit|vote|deposit)\b/i, "control bypass"],
  [/<\/?(system|assistant|tool)>|\[\s*(system|inst)\s*\]/i, "markup injection"],
];

export interface QuarantineResult {
  quarantined: boolean;
  reasons: string[];
}

export function screen(text: string): QuarantineResult {
  const reasons = PATTERNS.filter(([re]) => re.test(text)).map(([, label]) => label);
  return { quarantined: reasons.length > 0, reasons };
}
