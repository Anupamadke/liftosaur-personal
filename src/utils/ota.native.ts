// OTA updates disabled for personal build.
// Without this, Liftosaur's servers would overwrite our custom JS bundle on every app open.

export function Ota_activeBundleIdSync(): string | null {
  return null;
}

export async function Ota_init(): Promise<void> {
  // Intentionally disabled - no OTA updates in personal build
  return;
}

export async function Ota_activeBundleId(): Promise<string | null> {
  return null;
}

export async function Ota_revertToEmbedded(): Promise<void> {
  return;
}
