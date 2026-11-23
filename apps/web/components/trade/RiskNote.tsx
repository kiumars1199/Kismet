// F8: the note that sits next to every bet / deep-link button.
export const RISK_NOTE = "Bet only what you can afford to lose.";

export function RiskNote({ className = "" }: { className?: string }) {
  return <span data-testid="risk-note" className={`block text-center text-xs text-muted ${className}`}>{RISK_NOTE}</span>;
}
