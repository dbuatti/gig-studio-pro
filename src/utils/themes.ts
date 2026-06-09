export interface PublicTheme {
  name: string;
  primary: string;
  background: string;
  text: string;
  border: string;
}

export const PUBLIC_THEMES: PublicTheme[] = [
  { name: 'Vibrant Light', primary: '#9333ea', background: '#ffffff', text: '#1e1b4b', border: '#9333ea' },
  { name: 'Dark Pro', primary: '#4f46e5', background: '#020617', text: '#ffffff', border: '#4f46e5' },
  { name: 'Classic Black', primary: '#000000', background: '#000000', text: '#ffffff', border: '#ffffff' },
  { name: 'Purple Energy', primary: '#c084fc', background: '#2e1065', text: '#f5f3ff', border: '#c084fc' },
];

export const DEFAULT_COLORS = {
  primary: 'hsl(var(--primary))',
  background: 'hsl(var(--background))',
  text: 'hsl(var(--foreground))',
  border: 'hsl(var(--border))',
};
