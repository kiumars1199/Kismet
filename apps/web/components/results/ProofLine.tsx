// T-290: the backtest return never appears alone. This prints lib/proof's line (test result, then the live record
// beside it) with the basis one tap away (ProofLive: tap, Enter or Space; the hover title stays for a mouse). No hooks and no server imports
// here: server pages and client components share it; the toggle is the one client piece.
import type { Proof } from "@/lib/proof";
import { ProofLive } from "./ProofLive";

export function ProofLine({ p, className = "text-sm text-muted", testId = "proof-line", liveOnly = false }: {
  p: Proof; className?: string; testId?: string;
  /** the test result is already printed beside it (drawer, stat tiles): show only the live half */
  liveOnly?: boolean;
}) {
  return (
    <p className={className} data-testid={testId} title={p.help}>
      {p.test && !liveOnly ? <span data-testid="proof-test">{p.test} </span> : null}
      <ProofLive live={p.live} help={p.help} />
    </p>
  );
}
