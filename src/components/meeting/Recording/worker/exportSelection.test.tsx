import { hasCompleteDirectSegmentExport } from "./exportSelection";

function createManifest({ segments, exports }) {
  return {
    tracks: {
      video: { chunkCount: 2 },
      audio: { chunkCount: 2 },
    },
    segments,
    export: { segments: exports },
  };
}

const completeFiles = (id) => ({
  id,
  files: [
    { stream: "video", path: `exports/${id}-video.mp4` },
    { stream: "audio", path: `exports/${id}-audio.m4a` },
  ],
});

describe("hasCompleteDirectSegmentExport", () => {
  it("uses direct exports when every recorded segment has both tracks", () => {
    expect(
      hasCompleteDirectSegmentExport(
        createManifest({
          segments: [
            {
              id: 0,
              videoStartIndex: 0,
              videoEndIndex: 1,
              audioStartIndex: 0,
              audioEndIndex: 1,
            },
            {
              id: 1,
              videoStartIndex: 1,
              videoEndIndex: 2,
              audioStartIndex: 1,
              audioEndIndex: 2,
            },
          ],
          exports: [completeFiles(0), completeFiles(1)],
        }),
      ),
    ).toBe(true);
  });

  it("falls back to durable fragments when a recovered segment lacks a direct export", () => {
    expect(
      hasCompleteDirectSegmentExport(
        createManifest({
          segments: [
            {
              id: 0,
              videoStartIndex: 0,
              videoEndIndex: 1,
              audioStartIndex: 0,
              audioEndIndex: 1,
            },
            {
              id: 1,
              videoStartIndex: 1,
              videoEndIndex: 2,
              audioStartIndex: 1,
              audioEndIndex: 2,
            },
          ],
          exports: [completeFiles(1)],
        }),
      ),
    ).toBe(false);
  });

  it("falls back when a direct segment is missing its audio file", () => {
    expect(
      hasCompleteDirectSegmentExport(
        createManifest({
          segments: [
            {
              id: 0,
              videoStartIndex: 0,
              videoEndIndex: 1,
              audioStartIndex: 0,
              audioEndIndex: 1,
            },
          ],
          exports: [
            { id: 0, files: [{ stream: "video", path: "exports/video.mp4" }] },
          ],
        }),
      ),
    ).toBe(false);
  });
});
