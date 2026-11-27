// F15: "Last 30 days" on /admin (server component): totals and one row per UTC day. Counts and dollars only.
import { Stats } from "@/components/admin/Stats";
import { exactCount } from "@/lib/format";
import type { Mrr, Summary } from "@/lib/admin/metrics";

export function Metrics({ s, mrr }: { s: Summary; mrr: Mrr }) {
  const t = s.totals;
  return (
    <section aria-labelledby="metrics-h" className="flex flex-col gap-3" data-testid="admin-metrics">
      <h2 id="metrics-h" className="text-sm font-medium text-muted">Last 30 days (UTC days)</h2>
      <Stats label="Last 30 days totals" items={[
        { k: "Paying users now", v: exactCount(s.payingTotal), testId: "admin-paying-now" },
        { k: "Revenue, 30 days", v: t.revenue, testId: "admin-revenue-30d", title: "Sum of Stripe invoice.paid amounts recorded by the webhook" },
        { k: "MRR (estimate)", v: mrr.value, testId: "admin-mrr", sub: mrr.sub, title: mrr.title },
        { k: "Payments", v: exactCount(t.payments), testId: "admin-payments-30d", sub: `${exactCount(t.churned)} subscriptions ended · ${exactCount(t.trials)} trials started (30 days)` },
      ]} />
      {s.revenueNote && <p data-testid="admin-revenue-note" className="text-xs text-muted">{s.revenueNote}</p>}
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-sm tabular-nums" data-testid="admin-metrics-table">
          <caption className="sr-only">Sign-ups, trials, payments, revenue, cancellations and invites per day, newest first</caption>
          <thead className="text-left text-muted">
            <tr>
              {["Day", "Sign-ups", "Trials", "Payments", "Revenue", "Canceled", "Invites sent", "Invites verified"].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.day} className="border-t border-border" data-day={r.day}>
                <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-normal">{r.label}</th>
                <td className="px-3 py-2">{exactCount(r.signups)}</td>
                <td className="px-3 py-2">{exactCount(r.trials)}</td>
                <td className="px-3 py-2">{exactCount(r.payments)}</td>
                <td className="px-3 py-2" data-testid="admin-day-revenue">{r.revenue}</td>
                <td className="px-3 py-2">{exactCount(r.churned)}</td>
                <td className="px-3 py-2">{exactCount(r.invites_sent)}</td>
                <td className="px-3 py-2">{exactCount(r.invites_verified)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-medium">
              <th scope="row" className="px-3 py-2 text-left">Total</th>
              <td className="px-3 py-2">{exactCount(t.signups)}</td><td className="px-3 py-2">{exactCount(t.trials)}</td>
              <td className="px-3 py-2">{exactCount(t.payments)}</td><td className="px-3 py-2">{t.revenue}</td>
              <td className="px-3 py-2">{exactCount(t.churned)}</td><td className="px-3 py-2">{exactCount(t.invites_sent)}</td>
              <td className="px-3 py-2">{exactCount(t.invites_verified)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
