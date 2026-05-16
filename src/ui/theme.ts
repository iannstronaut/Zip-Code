// Theme constants for the TUI

export const theme = {
  // Brand gradient
  brandStart: '#6229d6', // purple
  brandEnd: '#2eb2b8', // teal/cyan
  // Roles
  user: 'magentaBright',
  assistant: 'cyanBright',
  system: 'yellow',
  tool: 'blueBright',
  toolSuccess: 'green',
  toolError: 'red',
  // Misc
  dim: 'gray',
  border: 'cyan',
  accent: 'magenta',
} as const;

// Hex gradient between two colors. Returns array of hex strings.
export function gradient(steps: number): string[] {
  const start = hexToRgb(theme.brandStart);
  const end = hexToRgb(theme.brandEnd);
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const r = Math.round(start.r + (end.r - start.r) * t);
    const g = Math.round(start.g + (end.g - start.g) * t);
    const b = Math.round(start.b + (end.b - start.b) * t);
    out.push(rgbToHex(r, g, b));
  }
  return out;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
