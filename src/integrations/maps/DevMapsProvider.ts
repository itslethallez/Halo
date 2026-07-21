import { NotImplementedError, type MapsProvider, type TravelEstimate } from "./MapsProvider";

/**
 * DEV adapter: returns a deterministic, plausible travel estimate derived from a simple hash
 * of the two addresses, so demo data is stable across runs without any external API call.
 */
export class DevMapsProvider implements MapsProvider {
  readonly providerName = "DEV_MOCK";

  async estimateTravelTime(fromAddress: string, toAddress: string): Promise<TravelEstimate> {
    const seed = `${fromAddress}|${toAddress}`.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const distanceKm = 2 + (seed % 28); // 2..30 km
    const travelMinutes = Math.round(distanceKm * 1.8 + 5); // rough city-driving heuristic
    return { travelMinutes, distanceKm };
  }

  async optimizeRoute(): Promise<string[]> {
    throw new NotImplementedError("Automatic driver route optimisation");
  }

  async *streamLiveLocation(): AsyncIterable<{ lat: number; lng: number; at: Date }> {
    throw new NotImplementedError("Live driver location tracking");
  }
}
