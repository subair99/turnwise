"use client";
// Circle Ledger (AG Grid Enterprise). Row click opens the audit drawer:
// agent, model version, rule, charter hash, PayPal object ID.
import { AgGridReact } from "ag-grid-react";
import { AllEnterpriseModule, LicenseManager, ModuleRegistry } from "ag-grid-enterprise";

ModuleRegistry.registerModules([AllEnterpriseModule]);
if (process.env.NEXT_PUBLIC_AG_GRID_LICENSE_KEY) LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE_KEY);

export interface LedgerRow {
  date: string;
  member: string;
  cycle: number;
  type: string;
  amount: string;
  status: string;
  agent: string;
  rule: string;
  paypalId: string;
}

export function CircleLedger({ rows }: { rows: LedgerRow[] }) {
  return (
    <div style={{ height: 520 }}>
      <AgGridReact<LedgerRow>
        rowData={rows}
        columnDefs={[
          { field: "date" },
          { field: "member", rowGroup: false, enableRowGroup: true },
          { field: "cycle", enableRowGroup: true },
          { field: "type", enableRowGroup: true },
          { field: "amount", type: "rightAligned" },
          { field: "status" },
          { field: "agent" },
          { field: "rule" },
          { field: "paypalId", headerName: "PayPal ID" },
        ]}
        defaultColDef={{ filter: true, sortable: true, resizable: true }}
      />
    </div>
  );
}
