import { buildRelayTrees } from "./relayTopology";

const members = Array.from({ length: 19 }, (_, i) => ({
  id: `p${i}`,
  foreground: true,
  desktop: true,
  forwarding: true,
}));
let serial;
const build = (overrides = {}) =>
  buildRelayTrees({
    hostId: "host",
    members,
    publishers: ["host", "p0", "p1", "p2"],
    createId: () => `edge${serial++}`,
    ...overrides,
  });
beforeEach(() => {
  serial = 0;
});
function checkTrees(edges, sources, people) {
  for (const source of sources) {
    const tree = edges.filter((edge) => edge.sourceId === source);
    expect(tree).toHaveLength(people.length - 1);
    for (const child of people.filter((id) => id !== source)) {
      let current = child;
      const visited = new Set();
      let hops = 0;
      while (current !== source) {
        expect(visited.has(current)).toBe(false);
        visited.add(current);
        const parents = tree.filter((edge) => edge.childId === current);
        expect(parents).toHaveLength(1);
        expect(parents[0].parentId).not.toBe(current);
        current = parents[0].parentId;
        hops += 1;
      }
      expect(hops).toBeLessThanOrEqual(4);
    }
    for (const parent of people) {
      const children = tree.filter(
        (edge) => edge.parentId === parent && !edge.fallback,
      );
      expect(children.length).toBeLessThanOrEqual(parent === source ? 3 : 2);
      if (source !== "host" && parent === "host")
        expect(children).toHaveLength(0);
    }
  }
}
it("delivers four separate sources to all 20 people with 76 edges and bounded fanout/hops", () => {
  const edges = build();
  expect(edges).toHaveLength(76);
  expect(edges.some((edge) => edge.fallback)).toBe(false);
  checkTrees(
    edges,
    ["host", "p0", "p1", "p2"],
    ["host", ...members.map((m) => m.id)],
  );
  for (const source of ["p0", "p1", "p2"])
    expect(edges).toContainEqual(
      expect.objectContaining({
        sourceId: source,
        parentId: source,
        childId: "host",
      }),
    );
});
it("preserves every healthy edge when a person joins", () => {
  const first = build({ members: members.slice(0, 18) });
  const next = build({ previous: first });
  for (const edge of first) expect(next).toContainEqual(edge);
});
it("reattaches departed branches without cycles and keeps independent routes", () => {
  const first = build();
  const parent = first.find(
    (edge) => edge.sourceId === "host" && edge.parentId !== "host",
  ).parentId;
  const remaining = members.filter((item) => item.id !== parent);
  const sources = ["host", "p0", "p1", "p2"].filter((id) => id !== parent);
  const repaired = build({
    members: remaining,
    publishers: sources,
    previous: first,
  });
  checkTrees(repaired, sources, ["host", ...remaining.map((m) => m.id)]);
  expect(
    repaired.some(
      (edge) => edge.parentId === parent || edge.childId === parent,
    ),
  ).toBe(false);
});
it("keeps every feed during direct fallback and never subscribes a publisher to itself", () => {
  const edges = build({
    members: members.map((member) => ({ ...member, forwarding: false })),
  });
  expect(edges).toHaveLength(76);
  expect(edges.filter((edge) => edge.fallback).length).toBeGreaterThan(50);
  checkTrees(
    edges,
    ["host", "p0", "p1", "p2"],
    ["host", ...members.map((m) => m.id)],
  );
});
it("avoids a failed parent/child route during branch repair", () => {
  const first = build();
  const broken = first.find(
    (edge) => edge.sourceId === "host" && edge.parentId !== "host",
  );
  const edges = build({
    previous: first,
    blocked: new Set([
      `${broken.sourceId}:${broken.parentId}:${broken.childId}`,
    ]),
  });
  expect(edges).not.toContainEqual(broken);
  checkTrees(
    edges,
    ["host", "p0", "p1", "p2"],
    ["host", ...members.map((m) => m.id)],
  );
});
