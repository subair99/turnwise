// Demo identity: real members would sign in. Plain GET form, so it works without JavaScript.
export function ActingAs({ members, current, path }: { members: { id: string; name: string }[]; current: string; path: string }) {
  return (
    <form method="get" action={path} className="as">
      <label htmlFor="as">Acting as</label>
      <select id="as" name="as" defaultValue={current}>
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <button className="btn quiet" type="submit">Switch</button>
      <span>(demo: in a real circle each member signs in)</span>
    </form>
  );
}
