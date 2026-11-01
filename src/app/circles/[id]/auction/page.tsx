export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section>
      <h1>Auction</h1>
      <p>Circle {id}. TODO: build the auction screen.</p>
    </section>
  );
}
