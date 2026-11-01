export default async function TrustPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section>
      <h1>Trust</h1>
      <p>Circle {id}. TODO: build the trust screen.</p>
    </section>
  );
}
