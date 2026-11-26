/** Pile des boîtes de dialogue ouvertes (la dernière est celle du dessus), pour savoir où afficher les messages éphémères. */
const stack: object[] = [];
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

export const dialogStore = {
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
  top: (): object | null => stack[stack.length - 1] ?? null,
  push(o: object) { stack.push(o); notify(); },
  remove(o: object) { const i = stack.indexOf(o); if (i >= 0) { stack.splice(i, 1); notify(); } },
};
