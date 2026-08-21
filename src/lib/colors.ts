const BRANCH_COLORS = [
  "oklch(0.68 0.09 68)",
  "oklch(0.44 0.062 148)",
  "oklch(0.52 0.17 27)",
  "oklch(0.58 0.06 250)",
  "oklch(0.53 0.075 128)",
  "oklch(0.6 0.08 40)",
  "oklch(0.5 0.05 300)",
  "oklch(0.62 0.11 32)",
];

export function branchColor(branchKey: string): string {
  let h = 0;
  for (let i = 0; i < branchKey.length; i++) h = (h * 31 + branchKey.charCodeAt(i)) >>> 0;
  return BRANCH_COLORS[h % BRANCH_COLORS.length]!;
}
