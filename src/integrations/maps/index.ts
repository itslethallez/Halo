import type { MapsProvider } from "./MapsProvider";
import { DevMapsProvider } from "./DevMapsProvider";
import { GoogleMapsProvider } from "./GoogleMapsProvider";

export * from "./MapsProvider";

export function getMapsProvider(): MapsProvider {
  const mode = process.env.INTEGRATION_MODE ?? "dev";
  return mode === "live" ? new GoogleMapsProvider() : new DevMapsProvider();
}
