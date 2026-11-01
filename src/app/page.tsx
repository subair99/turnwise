import Link from "next/link";

export default function Home() {
  return (
    <section>
      <h1>Turnwise</h1>
      <p>Your savings circle, without the collector.</p>
      <p><Link href="/judge">Judge mode: load the demo circle</Link></p>
    </section>
  );
}
