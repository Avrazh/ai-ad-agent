import type { FamilyId, FamilyDefinition, TemplateId } from "@/lib/types";
import type { RegisteredTemplate } from "./registry";
import { getStylesForFamily } from "./registry";

const families = new Map<FamilyId, FamilyDefinition>();

export function registerFamily(def: FamilyDefinition) {
  families.set(def.id, def);
}

export function getFamily(id: FamilyId): FamilyDefinition {
  const f = families.get(id);
  if (!f) throw new Error(`Family "${id}" not registered`);
  return f;
}

export function getAllFamilies(): FamilyDefinition[] {
  return Array.from(families.values());
}

export function pickRandomStyle(familyId: FamilyId): RegisteredTemplate {
  const styles = getStylesForFamily(familyId);
  if (styles.length === 0)
    throw new Error(`No styles registered for family "${familyId}"`);
  return styles[Math.floor(Math.random() * styles.length)];
}

export function pickDifferentStyle(
  familyId: FamilyId,
  currentStyleId: TemplateId
): RegisteredTemplate {
  const styles = getStylesForFamily(familyId);
  const others = styles.filter((s) => s.id !== currentStyleId);
  // If only one style exists in the family, return it unchanged
  const pool = others.length > 0 ? others : styles;
  return pool[Math.floor(Math.random() * pool.length)];
}
