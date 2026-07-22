export interface TravelEstimate {
  travelMinutes: number;
  distanceKm: number;
}

export interface MapsProvider {
  readonly providerName: string;
  estimateTravelTime(fromAddress: string, toAddress: string): Promise<TravelEstimate>;
  /**
   * Later-release feature (see /docs/09-folder-structure.md). Not implemented in the MVP —
   * throws NotImplementedError rather than faking a result. Would compute an optimal multi-stop
   * route for a driver with several jobs in a day.
   */
  optimizeRoute(stops: string[]): Promise<string[]>;
  /**
   * Later-release feature: live GPS tracking. Not implemented in the MVP — throws
   * NotImplementedError rather than a fake stream. See /docs/01-architecture.md §6.
   */
  streamLiveLocation(driverJobId: string): AsyncIterable<{ lat: number; lng: number; at: Date }>;
}

export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is a later-release feature and is not implemented in the MVP. See /docs/09-folder-structure.md.`);
    this.name = "NotImplementedError";
  }
}
