import { NotImplementedError, type MapsProvider, type TravelEstimate } from "./MapsProvider";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Live maps require this (see .env.example). Set INTEGRATION_MODE=dev to use the mock adapter instead.`);
  }
  return value;
}

/** Live adapter for the Google Distance Matrix API. Requires MAPS_API_KEY. */
export class GoogleMapsProvider implements MapsProvider {
  readonly providerName = "GOOGLE";

  async estimateTravelTime(fromAddress: string, toAddress: string): Promise<TravelEstimate> {
    const apiKey = requireEnv("MAPS_API_KEY");
    const params = new URLSearchParams({
      origins: fromAddress,
      destinations: toAddress,
      units: "metric",
      key: apiKey,
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Google Distance Matrix request failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as {
      rows: Array<{ elements: Array<{ duration: { value: number }; distance: { value: number }; status: string }> }>;
    };
    const element = data.rows[0]?.elements[0];
    if (!element || element.status !== "OK") {
      throw new Error(`Google Distance Matrix could not resolve a route between the given addresses`);
    }
    return {
      travelMinutes: Math.round(element.duration.value / 60),
      distanceKm: Math.round((element.distance.value / 1000) * 10) / 10,
    };
  }

  async optimizeRoute(): Promise<string[]> {
    throw new NotImplementedError("Automatic driver route optimisation");
  }

  async *streamLiveLocation(): AsyncIterable<{ lat: number; lng: number; at: Date }> {
    throw new NotImplementedError("Live driver location tracking");
  }
}
