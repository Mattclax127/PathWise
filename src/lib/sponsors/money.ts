export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "Unknown";
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}
