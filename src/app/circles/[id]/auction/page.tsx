import { db } from "@/lib/db";
import { auctionRows } from "@/services/views";
import { AuctionBoard } from "@/components/grid/AuctionBoard";
import { SubmitButton } from "@/components/SubmitButton";
import { outsideBid } from "./actions";

export const dynamic = "force-dynamic";

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await auctionRows(db, id);
  const rejected = a.rows.filter((r) => r.gate === "rejected").length;
  return (
    <>
      <p className="meta" style={{ marginBottom: 12 }}>
        Each member&rsquo;s Turn Agent places a sealed bid: the discount they&rsquo;ll give up to collect this cycle, shared with everyone
        else as dividends. The policy gate checks every bid against the member&rsquo;s mandate as it arrives. Amounts stay sealed until the
        auction closes, and code picks the highest valid bid.
        {rejected ? ` ${rejected} bid${rejected === 1 ? " was" : "s were"} rejected by the gate.` : ""}
      </p>
      {a.openAuction ? (
        <div className="callout" style={{ marginBottom: 14 }}>
          <p><strong>Cycle {a.openAuction.number} auction is open.</strong> Bids are sealed until it closes.</p>
          {a.live ? (
            <form action={outsideBid.bind(null, id)}>
              <p className="meta">Try what an outside assistant would do: bid $9 for a member whose mandate allows less.</p>
              <SubmitButton className="btn warn" pending="Sending the bid…">Send an over-cap outside bid</SubmitButton>
            </form>
          ) : null}
        </div>
      ) : null}
      {a.rows.length ? <AuctionBoard rows={a.rows} /> : <p className="meta">No bids yet. Bids appear when a cycle&rsquo;s pot is complete.</p>}
    </>
  );
}
