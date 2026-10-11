export function formatNaira(valueKobo: number): string {
  const naira = Math.round(valueKobo / 100)
  return `₦${naira.toLocaleString('en-NG')}`
}
