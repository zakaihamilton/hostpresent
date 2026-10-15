import { validateJsonPost } from "./apiSecurity";

function request({ contentType, contentLength, body }) {
  const headers = new Headers();
  if (contentType) headers.set("content-type", contentType);
  if (contentLength !== undefined) {
    headers.set("content-length", String(contentLength));
  }
  return { headers, body };
}

describe("validateJsonPost", () => {
  it("allows a genuinely empty request without headers", () => {
    expect(validateJsonPost(request({ body: null }))).toEqual({ ok: true });
  });

  it("validates requests with a body even when Content-Length is absent", () => {
    expect(
      validateJsonPost(request({ contentType: "text/plain", body: {} })),
    ).toMatchObject({ ok: false, status: 415 });
  });

  it("rejects malformed Content-Length values", () => {
    expect(
      validateJsonPost(
        request({ contentType: "application/json", contentLength: "NaN" }),
      ),
    ).toMatchObject({ ok: false, status: 400 });
  });
});
