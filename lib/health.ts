import { Platform } from 'react-native';
import {
  deleteObjects,
  isHealthDataAvailable,
  queryQuantitySamples,
  requestAuthorization,
  saveQuantitySample,
} from '@kingstinct/react-native-healthkit';

// iOS only, this phase — Android/Health Connect deferred. Confirmed stable on a real
// device (2026-07) after the react-native-health/RevenueCat New-Arch native-crash history
// in this app; keep every call here defensive (try/catch, never throw past this module).
const STEP_COUNT = 'HKQuantityTypeIdentifierStepCount' as const;
const DIETARY_ENERGY = 'HKQuantityTypeIdentifierDietaryEnergyConsumed' as const;

let authorized = false;

export function isHealthKitAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return isHealthDataAvailable();
  } catch {
    return false;
  }
}

// Must fully resolve before any read/write call below — the library's own docs warn
// that querying/saving before authorization has been requested crashes the app.
export async function requestHealthPermissions(): Promise<boolean> {
  if (!isHealthKitAvailable()) return false;
  try {
    const granted = await requestAuthorization({
      toRead: [STEP_COUNT],
      toShare: [DIETARY_ENERGY],
    });
    authorized = granted;
    return granted;
  } catch (e) {
    console.warn('[health] requestAuthorization failed', e);
    return false;
  }
}

// Trailing N-day average daily steps — smooths out a single unusual day before it
// flips the suggested activity level. null if unavailable/unauthorized/failed.
export async function getAverageDailySteps(days = 14): Promise<number | null> {
  if (!authorized) return null;
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const samples = await queryQuantitySamples(STEP_COUNT, {
      limit: 0, // all samples in range
      unit: 'count',
      ascending: true,
      filter: { date: { startDate, endDate: new Date() } },
    });
    if (!samples.length) return null;
    const total = samples.reduce((sum, s) => sum + s.quantity, 0);
    return Math.round(total / days);
  } catch (e) {
    console.warn('[health] getAverageDailySteps failed', e);
    return null;
  }
}

// Fire-and-forget — a HealthKit write failure must never affect meal logging.
// Returns the saved sample's uuid (needed to delete/replace it later via
// deleteDietaryEnergySample), or null if the write didn't happen/failed.
export async function writeDietaryEnergy(calories: number, date: Date): Promise<string | null> {
  if (!authorized) return null;
  try {
    const sample = await saveQuantitySample(DIETARY_ENERGY, 'kcal', calories, date, date);
    return sample?.uuid ?? null;
  } catch (e) {
    console.warn('[health] writeDietaryEnergy failed', e);
    return null;
  }
}

// Fire-and-forget — used to keep Apple Health in sync when a logged meal is edited/deleted.
export async function deleteDietaryEnergySample(uuid: string): Promise<void> {
  if (!authorized) return;
  try {
    await deleteObjects(DIETARY_ENERGY, { uuid });
  } catch (e) {
    console.warn('[health] deleteDietaryEnergySample failed', e);
  }
}
