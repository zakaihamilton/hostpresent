import {
  assignedIncomingEdge,
  MEDIA_PROTOCOL_VERSION,
  validMediaPlan,
} from "./audienceProtocol";

const edge = {
  id: "edge",
  sourceId: "host",
  parentId: "host",
  childId: "guest",
  fallback: false,
};
const plan = {
  version: MEDIA_PROTOCOL_VERSION,
  epoch: "epoch",
  revision: 1,
  publishers: ["host"],
  edges: [edge],
};
it.each([
  null,
  {},
  { ...plan, edges: [null] },
  { ...plan, edges: [edge, edge] },
  { ...plan, edges: [{ ...edge, sourceId: "unapproved" }] },
  { ...plan, edges: [{ ...edge, childId: "host" }] },
  { ...plan, edges: [{ ...edge, parentId: "guest" }] },
  { ...plan, publishers: ["host", "one", "two", "three", "four"] },
])("rejects malformed or unauthorized assignment plans: %p", (candidate) => {
  expect(validMediaPlan(candidate, "guest", "host")).toBe(false);
});
it("rejects media before any assignment even when metadata omits the epoch", () => {
  expect(
    assignedIncomingEdge(
      null,
      { metadata: { version: MEDIA_PROTOCOL_VERSION } },
      "guest",
    ),
  ).toBeNull();
});
it("accepts a well-formed host plan", () => {
  expect(validMediaPlan(plan, "guest", "host")).toBe(true);
});
