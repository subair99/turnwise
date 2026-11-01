export default async function CharterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section>
      <h1>Charter</h1>
      <p>Circle {id}. TODO: build the charter screen.</p>
    </section>
  );
}
