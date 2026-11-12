/** Published facts checked 2026-11-12. A design speed is never used as an operating limit. */
export interface TrainSpeedProfile {
  simulationMaxKmh: number;
  publishedMaxKmh: number | null;
  designKmh: number | null;
  source: { label: string; url: string; checkedOn: string } | null;
}

const checkedOn = "2026-11-12";
const EXPRESS_SPEEDS: Record<string, TrainSpeedProfile> = {
  rrts: {
    simulationMaxKmh: 160, publishedMaxKmh: 160, designKmh: 180,
    source: { label: "NCRTC corporate folder (January 2025)", url: "https://ncrtc.in/wp-content/uploads/2025/01/NCRTC-Corporate-Folder_Eng-Jan-2025.pdf", checkedOn },
  },
  airport_express: {
    simulationMaxKmh: 120, publishedMaxKmh: 120, designKmh: null,
    source: { label: "DMRC Annual Report 2023–24, printed page 4", url: "https://backend.delhimetrorail.com/documents/7611/Annual-Report-2023-24-English.pdf#page=6", checkedOn },
  },
  meerut_metro: {
    simulationMaxKmh: 120, publishedMaxKmh: 120, designKmh: 135,
    source: { label: "Alstom Meerut Metro trainset announcement (16 February 2024)", url: "https://www.alstom.com/press-releases-news/2024/2/alstom-successfully-delivers-first-trainset-meerut-metro-project", checkedOn },
  },
};

/** Regular metro/Aqua limits are nominal model settings until individually sourced, not published facts. */
export function trainSpeedProfile(lineId: string, nominalMaxKmh = 60): TrainSpeedProfile {
  return EXPRESS_SPEEDS[lineId] ?? { simulationMaxKmh: nominalMaxKmh, publishedMaxKmh: null, designKmh: null, source: null };
}
