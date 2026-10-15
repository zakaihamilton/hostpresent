import { ReadableStream } from "node:stream/web";
import { TextEncoder } from "node:util";
import { BODY_TOO_LARGE, readJsonBody } from "./routeHelpers";

function requestWithJson(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  };
}

describe("readJsonBody", () => {
  it("bounds streamed request bodies without Content-Length", async () => {
    const request = requestWithJson({ value: "x".repeat(100) });

    await expect(readJsonBody(request, { maxBytes: 32 })).resolves.toBe(
      BODY_TOO_LARGE,
    );
  });

  it("parses a bounded JSON request", async () => {
    const request = requestWithJson({ ok: true });

    await expect(readJsonBody(request, { maxBytes: 32 })).resolves.toEqual({
      ok: true,
    });
  });
});
