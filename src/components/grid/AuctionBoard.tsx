"use client";
// Auction Board (AG Grid Enterprise): sealed bids grouped by cycle; each marked passed or rejected by the policy gate.
import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import "./modules";
import type { BidRow } from "@/services/views";
import { turnwiseTheme } from "./theme";


export function AuctionBoard({ rows }: { rows: BidRow[] }) {
  const columnDefs = useMemo<ColDef<BidRow>[]>(
    () => [
      { field: "cycle", rowGroup: true, hide: true },
      { field: "member", headerName: "Member", width: 130 },
      { field: "source", headerName: "From", width: 190 },
      {
        field: "discount",
        headerName: "Discount",
        type: "rightAligned",
        width: 120,
        valueFormatter: (p) => (p.node?.group ? "" : p.value === null || p.value === undefined ? "Sealed" : `$${Number(p.value).toFixed(2)}`),
      },
      {
        field: "gate",
        headerName: "Policy gate",
        width: 130,
        valueFormatter: (p) => (p.value === "rejected" ? "Rejected" : p.value === "passed" ? "Passed" : ""),
        cellStyle: (p) => (p.value === "rejected" ? { color: "#a63d25", fontWeight: 700 } : p.value === "passed" ? { color: "#2e6b47", fontWeight: 700 } : null),
      },
      { field: "reason", headerName: "Why", width: 190 },
      { field: "result", headerName: "Result", width: 110, cellStyle: (p) => (p.value === "Winner" ? { color: "#7a5813", fontWeight: 700 } : null) },
      { field: "explanation", headerName: "Agent's reason", flex: 1, minWidth: 260, tooltipField: "explanation" },
    ],
    [],
  );
  return (
    <div style={{ height: 560 }}>
      <AgGridReact<BidRow>
        theme={turnwiseTheme}
        rowData={rows}
        getRowId={(p) => p.data.id}
        columnDefs={columnDefs}
        defaultColDef={{ sortable: true, resizable: true, filter: true, suppressHeaderFilterButton: true }}
        autoGroupColumnDef={{ headerName: "Cycle", minWidth: 170 }}
        groupDefaultExpanded={-1}
        tooltipShowDelay={300}
      />
    </div>
  );
}
