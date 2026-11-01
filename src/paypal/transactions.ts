import { paypalFetch } from "./client";

// Transaction Search: used by the nightly reconciliation and the Turn Passport.
// Note: newly completed transactions can take time to appear in search results.
export async function searchTransactions(start: Date, end: Date) {
  const qs = new URLSearchParams({
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    fields: "all",
    page_size: "500",
  });
  return paypalFetch<{ transaction_details?: unknown[] }>(`/v1/reporting/transactions?${qs}`);
}
