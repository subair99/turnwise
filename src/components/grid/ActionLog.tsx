"use client";
// Action log (AG Grid Enterprise): every proposal the gate saw, allowed or refused, newest first.
import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import type { CellStyle, ColDef } from "ag-grid-community";
import type { AuditRow } from "@/services/views-6b";
import { turnwiseTheme } from "./theme";
import "./modules";

export function ActionLog({ rows }: { rows: AuditRow[] }) {
  const columnDefs = useMemo<ColDef<AuditRow>[]>(
    () => [
      { field: "time", headerName: "When", sort: "desc", width: 170, valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "") },
      { field: "agent", headerName: "Who proposed it", enableRowGroup: true, width: 170 },
      { field: "action", headerName: "Action", enableRowGroup: true, flex: 1, minWidth: 200 },
      { field: "member", headerName: "Member", enableRowGroup: true, width: 130 },
      { field: "cycle", headerName: "Cycle", width: 100 },
      {
        field: "decision",
        headerName: "Gate",
        enableRowGroup: true,
        width: 120,
        cellStyle: (p) => (p.value === "Refused" ? ({ color: "#a63d25", fontWeight: 700 } as CellStyle) : p.value === "Allowed" ? ({ color: "#2e6b47", fontWeight: 700 } as CellStyle) : null),
      },
      { field: "reasons", headerName: "Why refused", flex: 1, minWidth: 200, tooltipField: "reasons" },
      { field: "model", headerName: "Model", width: 150, hide: true },
      { field: "paypalId", headerName: "PayPal ID", width: 170 },
      { field: "requestId", headerName: "PayPal-Request-Id", hide: true },
    ],
    [],
  );
  return (
    <div style={{ height: 520 }}>
      <AgGridReact<AuditRow>
        theme={turnwiseTheme}
        rowData={rows}
        getRowId={(p) => p.data.id}
        columnDefs={columnDefs}
        defaultColDef={{ sortable: true, resizable: true, filter: true, suppressHeaderFilterButton: true }}
        rowGroupPanelShow="always"
        sideBar={{ toolPanels: ["columns", "filters"], defaultToolPanel: "" }}
        tooltipShowDelay={300}
        pagination
        paginationPageSize={50}
      />
    </div>
  );
}
