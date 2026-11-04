"use client";
// Circle Ledger (AG Grid Enterprise). Ask it questions in plain words: the AI Toolkit turns the question into a grid
// state (filters, grouping, sorting, aggregation) that is validated on the server and applied with setState().
// Selecting a row opens its audit record: agent, model, rule, charter hash, request ID and PayPal ID.
import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { CellStyle, ColDef, GridApi, GridState, RowClickedEvent } from "ag-grid-community";
import "./modules";
import type { LedgerRow } from "@/services/views";
import { turnwiseTheme } from "./theme";


const usd = (v: unknown) => (typeof v === "number" ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "");
const SUGGESTIONS = ["Who has paid late twice?", "Total paid out per member", "Show only missed payments", "Contributions by cycle"];

export function CircleLedger({ rows }: { rows: LedgerRow[] }) {
  const grid = useRef<AgGridReact<LedgerRow>>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<LedgerRow | null>(null);
  const initial = useRef<GridState | null>(null);

  const columnDefs = useMemo<ColDef<LedgerRow>[]>(
    () => [
      { field: "date", headerName: "Date", sort: "asc", valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""), filter: "agDateColumnFilter", filterValueGetter: (p) => (p.data ? new Date(p.data.date) : null), width: 130 },
      { field: "cycle", headerName: "Cycle", enableRowGroup: true, filter: "agNumberColumnFilter", width: 100 },
      { field: "member", headerName: "Member", enableRowGroup: true, enablePivot: true },
      { field: "city", headerName: "City", enableRowGroup: true, hide: true },
      { field: "type", headerName: "Type", enableRowGroup: true, enablePivot: true },
      { field: "direction", headerName: "Money", enableRowGroup: true, width: 110 },
      { field: "amount", headerName: "Amount", type: "rightAligned", valueFormatter: (p) => usd(p.value), enableValue: true, defaultAggFunc: "sum", allowedAggFuncs: ["sum", "count", "avg", "min", "max"], filter: "agNumberColumnFilter", width: 130 },
      { field: "timing", headerName: "Timing", enableRowGroup: true, cellStyle: (p) => (p.value === "Late" || String(p.value).startsWith("Missed") ? { color: "#a63d25", fontWeight: 700 } : null) },
      { field: "status", headerName: "Status", filter: false, cellStyle: (p) => (String(p.value).startsWith("Failed") ? { color: "#a63d25", fontWeight: 700 } : String(p.value).startsWith("Confirmed") ? ({ color: "#2e6b47" } as CellStyle) : null) },
      { field: "method", headerName: "Method", enableRowGroup: true, hide: true, filter: false },
      { field: "agent", headerName: "Agent", enableRowGroup: true, filter: false },
      { field: "paypalId", headerName: "PayPal ID", filter: false },
      { field: "rule", headerName: "Rule", hide: true, filter: false },
      { field: "model", headerName: "Model", hide: true, filter: false },
    ],
    [],
  );

  const ask = useCallback(
    async (q: string) => {
      const api = grid.current?.api;
      if (!api || !q.trim()) return;
      setBusy(true);
      setAnswer(null);
      try {
        initial.current ??= api.getState();
        const schema = api.getStructuredSchema({
          columns: {
            timing: { description: "Whether a contribution was paid on time, late (after a reminder), or missed and covered by the member's deposit", includeSetValues: true },
            type: { description: "Contribution, Payout (the winner's pot), Dividend (share of the winning discount), Deposit held, Deposit applied, Deposit refund", includeSetValues: true },
            member: { description: "Member name", includeSetValues: true },
            direction: { description: "In = into the circle, Out = paid out, Held/Applied/Returned = deposits", includeSetValues: true },
            amount: { description: "Amount in US dollars" },
            cycle: { description: "Cycle number; one member collects the pot each cycle" },
            agent: { description: "Which agent proposed the money move (member, treasurer, guardian, turn-agent)" },
          },
        });
        const res = await fetch("/api/ledger/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, gridState: api.getState(), schema }),
        });
        const data = (await res.json()) as { gridState?: GridState | null; propertiesToIgnore?: string[]; explanation?: string };
        if (data.gridState) {
          api.setState(data.gridState, (data.propertiesToIgnore ?? []) as NonNullable<Parameters<GridApi<LedgerRow>["setState"]>[1]>);
          const explanation = data.explanation ?? "Done.";
          setAnswer({ text: explanation });
          setTimeout(() => {
            if (api.getDisplayedRowCount() === 0) setAnswer({ text: `${explanation} No rows match this view, so the question may have been read too narrowly. Rephrase it or press Reset view.`, error: true });
          }, 50);
        } else {
          setAnswer({ text: data.explanation ?? "That question couldn't be turned into a view of the ledger.", error: true });
        }
      } catch {
        setAnswer({ text: "The ledger assistant is unavailable right now. You can still filter and group the columns yourself.", error: true });
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const reset = () => {
    const api = grid.current?.api;
    if (api && initial.current) api.setState(initial.current);
    setAnswer(null);
    setQuestion("");
  };

  return (
    <>
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <label htmlFor="ledger-q" className="meta" style={{ position: "absolute", left: -9999 }}>Ask the ledger</label>
        <input id="ledger-q" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask the ledger, e.g. Who has paid late twice?" list="ledger-suggestions" maxLength={300} />
        <datalist id="ledger-suggestions">{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Asking…" : "Ask"}</button>
        <button className="btn quiet" type="button" onClick={reset}>Reset view</button>
      </form>
      <p className={`answer${answer?.error ? " err" : ""}`} aria-live="polite">{answer?.text ?? ""}</p>

      <div className={`grid-and-drawer${selected ? " open" : ""}`}>
        <div style={{ height: 600 }}>
          <AgGridReact<LedgerRow>
            ref={grid}
            theme={turnwiseTheme}
            rowData={rows}
            getRowId={(p) => p.data.id}
            columnDefs={columnDefs}
            defaultColDef={{ filter: true, sortable: true, resizable: true, flex: 1, minWidth: 140, suppressHeaderFilterButton: true }}
            autoGroupColumnDef={{ minWidth: 200 }}
            rowGroupPanelShow="always"
            groupDisplayType="singleColumn"
            sideBar={{ toolPanels: ["columns", "filters"], hiddenByDefault: false, defaultToolPanel: "" }}
            enableCharts
            cellSelection
            animateRows
            onRowClicked={(e: RowClickedEvent<LedgerRow>) => e.data && setSelected(e.data)}
          />
        </div>
        {selected ? (
          <aside className="drawer" aria-label="Audit record">
            <button className="btn quiet close" type="button" onClick={() => setSelected(null)}>Close</button>
            <h3>{selected.type}: {selected.member}, cycle {selected.cycle}</h3>
            <dl>
              <div><dt>Amount</dt><dd>{usd(selected.amount)} ({selected.direction.toLowerCase()})</dd></div>
              <div><dt>Status</dt><dd>{selected.status}</dd></div>
              <div><dt>Proposed by</dt><dd>{selected.agent || "not recorded"}</dd></div>
              <div><dt>Model</dt><dd>{selected.model || "none: code only"}</dd></div>
              <div><dt>Rule the gate applied</dt><dd>{selected.rule || "not recorded"}</dd></div>
              <div><dt>Gate decision</dt><dd>{selected.gate || "not recorded"}</dd></div>
              <div><dt>Charter hash</dt><dd>{selected.charterHash || "none"}</dd></div>
              <div><dt>PayPal-Request-Id</dt><dd>{selected.requestId || "none"}</dd></div>
              <div><dt>PayPal ID</dt><dd>{selected.paypalId || (selected.model === "simulated" ? "none: simulated history" : "none")}</dd></div>
            </dl>
          </aside>
        ) : null}
      </div>
    </>
  );
}
