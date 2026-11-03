import { db } from "@/lib/db";
import { ledgerRows } from "@/services/views";
import { CircleLedger } from "@/components/grid/CircleLedger";

export const dynamic = "force-dynamic";

export default async function LedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await ledgerRows(db, id);
  return (
    <>
      <p className="meta" style={{ marginBottom: 12 }}>
        Every contribution, payout, dividend and deposit, with the agent that proposed it, the rule the gate applied and the PayPal ID.
        Select a row to see its audit record.
      </p>
      <CircleLedger rows={rows} />
    </>
  );
}
