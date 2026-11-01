export default async function PassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section>
      <h1>Passport</h1>
      <p>Circle {id}. TODO: build the passport screen.</p>
    </section>
  );
}
