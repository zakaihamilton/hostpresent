export function hasCompleteDirectSegmentExport(manifest) {
  const recordedSegments = (manifest.segments ?? []).filter((segment) =>
    ["video", "audio"].some((stream) => {
      const start = segment[`${stream}StartIndex`] ?? 0;
      const end =
        segment[`${stream}EndIndex`] ??
        manifest.tracks[stream]?.chunkCount ??
        0;
      return end > start;
    }),
  );
  if (recordedSegments.length === 0) return false;
  const exportsById = new Map(
    (manifest.export?.segments ?? []).map((segment) => [segment.id, segment]),
  );
  return recordedSegments.every((segment) => {
    const exported = exportsById.get(segment.id);
    return ["video", "audio"].every((stream) =>
      exported?.files?.some((file) => file.stream === stream && file.path),
    );
  });
}
