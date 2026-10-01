// A directed tree for each source: the host monitors guest sources as a leaf.
// Only explicitly eligible audience browsers forward. Fallback edges may exceed
// host fanout, but never the total of (members - 1) edges per source.
export function buildRelayTrees({
  hostId,
  members,
  publishers,
  previous = [],
  blocked = new Set(),
  createId = () => crypto.randomUUID(),
}) {
  const people = [hostId, ...members.map((member) => member.id)];
  const eligible = new Set(
    members
      .filter(
        (member) => member.foreground && member.desktop && member.forwarding,
      )
      .map((member) => member.id),
  );
  const edges = [];
  const load = new Map();
  const old = new Map(
    previous.map((edge) => [`${edge.sourceId}:${edge.childId}`, edge]),
  );
  for (const sourceId of publishers) {
    const depths = new Map([[sourceId, 0]]);
    const counts = new Map();
    const pending = new Set(people.filter((id) => id !== sourceId));
    const allowed = (parentId, childId, fallback = false) => {
      if (
        parentId === childId ||
        !depths.has(parentId) ||
        blocked.has(`${sourceId}:${parentId}:${childId}`)
      )
        return false;
      if (fallback) return parentId === hostId;
      if (depths.get(parentId) >= 4) return false;
      if (
        parentId !== sourceId &&
        (!eligible.has(parentId) || parentId === hostId)
      )
        return false;
      return (counts.get(parentId) ?? 0) < (parentId === sourceId ? 3 : 2);
    };
    const add = (parentId, childId, fallback = false) => {
      const existing = old.get(`${sourceId}:${childId}`);
      edges.push({
        sourceId,
        parentId,
        childId,
        fallback,
        id:
          existing?.parentId === parentId && existing.fallback === fallback
            ? existing.id
            : createId(),
      });
      depths.set(childId, depths.get(parentId) + 1);
      counts.set(parentId, (counts.get(parentId) ?? 0) + (fallback ? 0 : 1));
      load.set(parentId, (load.get(parentId) ?? 0) + 1);
      pending.delete(childId);
    };
    if (sourceId !== hostId) add(sourceId, hostId);
    // Preserve healthy routes in topological order. A departed parent only
    // invalidates its branch; independent branches keep their edge identifiers.
    let progress = true;
    while (progress) {
      progress = false;
      for (const childId of pending) {
        const edge = old.get(`${sourceId}:${childId}`);
        if (edge && !edge.fallback && allowed(edge.parentId, childId)) {
          add(edge.parentId, childId);
          progress = true;
        }
      }
    }
    // Place eligible forwarders before leaves to make room for all 19 viewers.
    const ordered = [...pending].sort(
      (a, b) => Number(eligible.has(b)) - Number(eligible.has(a)),
    );
    for (const childId of ordered) {
      if (!pending.has(childId)) continue;
      // Never attach a parent below one of its previous descendants: repairing
      // a branch must not transiently create a forwarding cycle.
      const descendants = new Set([childId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const edge of previous.filter(
          (item) => item.sourceId === sourceId,
        )) {
          if (
            descendants.has(edge.parentId) &&
            !descendants.has(edge.childId)
          ) {
            descendants.add(edge.childId);
            changed = true;
          }
        }
      }
      const parents = [...depths.keys()].filter(
        (id) => !descendants.has(id) && allowed(id, childId),
      );
      parents.sort(
        (a, b) =>
          (load.get(a) ?? 0) - (load.get(b) ?? 0) ||
          depths.get(a) - depths.get(b) ||
          a.localeCompare(b),
      );
      if (parents.length) add(parents[0], childId);
      else add(hostId, childId, true);
      // Descendants with an unchanged edge can now resume their healthy branch.
      for (const next of ordered) {
        if (!pending.has(next)) continue;
        const edge = old.get(`${sourceId}:${next}`);
        if (edge && !edge.fallback && allowed(edge.parentId, next))
          add(edge.parentId, next);
      }
    }
  }
  return edges;
}
