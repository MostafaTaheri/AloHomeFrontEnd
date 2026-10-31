import { featureStatusName, type FeatureDecision } from "@/lib/api/governance";

/**
 * Pilot scope gating (GOV-03). A screen tied to a catalogue feature is shown only while that
 * feature is Active. When the catalogue cannot be loaded, or does not list the feature, the
 * screen stays visible: the API decides what a person may do, the catalogue only trims the
 * navigation to the agreed scope.
 */
export function isFeatureActive(
  features: readonly FeatureDecision[] | undefined,
  key: string | undefined,
): boolean {
  if (!key || !features) return true;
  const decision = features.find((f) => f.key === key);
  return !decision || featureStatusName(decision.status) === "Active";
}

/** Keeps the items whose feature is active (or that have no feature key). */
export function activeItems<T extends { feature?: string }>(
  items: readonly T[],
  features: readonly FeatureDecision[] | undefined,
): T[] {
  return items.filter((item) => isFeatureActive(features, item.feature));
}
