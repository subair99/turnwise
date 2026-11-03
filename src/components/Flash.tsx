export function Flash({ msg, err }: { msg?: string; err?: string }) {
  if (err) return <div className="callout bad" role="alert"><p>{err}</p></div>;
  if (msg) return <div className="callout" role="status"><p>{msg}</p></div>;
  return null;
}
