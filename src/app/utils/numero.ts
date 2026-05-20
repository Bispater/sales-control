// Parser robusto de números provenientes de Excel/CSV en formato chileno o US.
// Reglas:
//   "1.234,56"  → 1234.56  (chileno: punto = miles, coma = decimal)
//   "1,234.56"  → 1234.56  (US: coma = miles, punto = decimal)
//   "12,920"    → 12920    (coma + 3 dígitos sin más separadores → miles)
//   "267,3"     → 267.3    (coma + 1-2 dígitos → decimal)
//   "12.345.678"→ 12345678 (múltiples puntos → todos son miles)
//   "20%"       → 20
//   "-413,435"  → -413435
export function toNumber(valor: unknown): number {
  if (typeof valor === 'number') return valor;
  if (valor === null || valor === undefined) return 0;
  let s = String(valor).trim();
  if (!s) return 0;
  // Limpiar símbolos de moneda, porcentaje y espacios.
  s = s.replace(/[%$€₡]/g, '').replace(/\s/g, '');
  if (!s || s === '-' || s === '.') return 0;

  const negativo = s.startsWith('-');
  if (negativo) s = s.slice(1);

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    const partes = s.split(',');
    const esMiles = partes.length > 1 && partes.slice(1).every((p) => /^\d{3}$/.test(p));
    if (esMiles) s = partes.join('');
    else s = s.replace(',', '.');
  } else if (hasDot) {
    const partes = s.split('.');
    if (partes.length > 2 && partes.slice(1).every((p) => /^\d{3}$/.test(p))) {
      s = partes.join('');
    }
  }

  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return negativo ? -n : n;
}
