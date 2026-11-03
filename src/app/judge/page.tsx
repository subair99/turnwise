import { db } from "@/lib/db";
import { liveReadiness } from "@/services/demo-seed";
import { SubmitButton } from "@/components/SubmitButton";
import { loadDemoCircle, startLive } from "./actions";

export const dynamic = "force-dynamic";

export default async function JudgeMode({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const live = await liveReadiness(db);
  return (
    <section className="judge">
      <div style={{ display: "grid", gap: 10 }}>
        <h1>Judge mode</h1>
        <p className="meta">Two ways to see Turnwise. Both use fictional members.</p>
      </div>
      {error ? <div className="callout bad" role="alert"><p>{error}</p></div> : null}

      <form action={loadDemoCircle}>
        <h2>Load the demo circle</h2>
        <p>
          Eight members in Lagos, London and Houston saving $100 a month, six cycles in. The history is simulated, so it has no
          PayPal IDs, but it shows a full circle: sealed bids, two rejected by the gate, late payments and a deposit that covered a
          missed one. Ask the ledger &ldquo;Who has paid late twice?&rdquo;
        </p>
        <SubmitButton pending="Loading the circle…">Load the demo circle</SubmitButton>
      </form>

      <form action={startLive}>
        <h2>Start a live circle in the PayPal sandbox</h2>
        <p>
          A real circle with {live.emails.length || "your"} sandbox members, on demo time (one circle day passes in under a second).
          The Treasurer drafts the charter, each payment is authorized from a saved PayPal wallet and captured on the due date, one
          member misses a payment so the default steps run, and every payout is confirmed by PayPal. It takes about three minutes.
        </p>
        {live.missing.length ? (
          <div className="callout bad">
            <p>No saved PayPal wallet yet for {live.missing.join(", ")}. Run <code>pnpm money:loop</code> once, or set SANDBOX_VAULTS.</p>
          </div>
        ) : null}
        <p className="meta">The worker runs live circles. Locally, start it in a second terminal with <code>pnpm worker</code>.</p>
        <SubmitButton pending="Starting: the Treasurer is drafting the charter…">Start a live circle</SubmitButton>
      </form>
    </section>
  );
}
