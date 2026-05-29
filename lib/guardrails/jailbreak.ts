const PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /disregard\s+(your\s+)?(previous|prior|all)\s+/i,
  /forget\s+(everything|all|your)\s+/i,
  /you\s+are\s+now\s+(?!an?\s+hr)/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /act\s+as\s+(if\s+you('re|\s+are)\s+)?a\s+/i,
  /new\s+(persona|identity|role)/i,
  /override\s+(your\s+)?(instructions?|rules?|constraints?|system)/i,
  /bypass\s+(your\s+)?(instructions?|rules?|constraints?|filters?)/i,
  /reveal\s+(your\s+)?(system\s+)?prompt/i,
  /show\s+me\s+(your\s+)?(system\s+)?prompt/i,
  /what\s+(are|is)\s+your\s+(system\s+)?prompt/i,
  /jailbreak/i,
  /\bdan\s+mode\b/i,
  /developer\s+mode/i,
  /unrestricted\s+mode/i,
  /do\s+anything\s+now/i,
];

export function isJailbreakAttempt(input: string): boolean {
  return PATTERNS.some((p) => p.test(input));
}
