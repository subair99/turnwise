export default async function MandatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section>
      <h1>Mandate</h1>
      <p>Circle {id}. TODO: build the mandate screen.</p>
    </section>
  );
}
