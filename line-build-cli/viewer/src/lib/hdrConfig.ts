/**
 * Re-export HDR config utilities for the viewer.
 * This wrapper ensures proper module resolution in Next.js.
 */

export {
  loadActiveHdrConfig,
  loadHdrConfig,
  listHdrConfigs,
  setActiveHdrConfig,
  saveHdrConfig,
  getActiveConfigId,
} from "../../../scripts/lib/hdrConfig";

export type { HdrPodConfig, Pod, PodType } from "../../../config/hdr-pod.mock";
