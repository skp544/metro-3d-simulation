export type UndergroundMode = "auto" | "surface" | "underground";

export function groundVisible(s: {
  undergroundMode: UndergroundMode;
  undergroundFollow: { trainId: string; underground: boolean } | null;
  follow: { trainId: string } | null;
}) {
  return s.undergroundMode === "surface" || (s.undergroundMode === "auto" &&
    !(s.follow && s.undergroundFollow?.trainId === s.follow.trainId && s.undergroundFollow.underground));
}
