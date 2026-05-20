const PALETA = [
  '#2563eb', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#0891b2',
  '#ec4899', '#84cc16', '#eab308', '#14b8a6', '#6366f1', '#f43f5e',
];

export function colorPorNombre(nombre: string): string {
  if (!nombre) return '#64748b';
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length];
}

export function iniciales(nombre: string): string {
  if (!nombre) return '?';
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
