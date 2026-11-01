export default async function LedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section>
      <h1>Ledger</h1>
      <p>Circle {id}. TODO: build the ledger screen.</p>
    </section>
  );
}
