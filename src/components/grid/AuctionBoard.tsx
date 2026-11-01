"use client";
// Auction Board: sealed bids revealed at close, each marked passed or rejected by the policy gate.
import { AgGridReact } from "ag-grid-react";

export interface BidRow {
  member: string;
  source: "turn-agent" | "mcp";
  discount: string;
  gate: "passed" | "rejected";
  reason: string;
}

export function AuctionBoard({ rows }: { rows: BidRow[] }) {
  return (
    <div style={{ height: 360 }}>
      <AgGridReact<BidRow>
        rowData={rows}
        columnDefs={[
          { field: "member" },
          { field: "source" },
          { field: "discount", type: "rightAligned" },
          { field: "gate", cellStyle: (p) => ({ color: p.value === "rejected" ? "#b42318" : "#067647", fontWeight: 600 }) },
          { field: "reason" },
        ]}
      />
    </div>
  );
}
