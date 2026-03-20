// To add a new language: add one entry to TRANSLATION_TARGETS. Nothing else changes.
export type TranslationLangCode = "sv" | "el" | "fr" | "es";

export const TRANSLATION_TARGETS: {
  code: TranslationLangCode;
  label: string;
  name: string;
}[] = [
  { code: "sv", label: "SE", name: "Swedish" },
  { code: "el", label: "GR", name: "Greek" },
  { code: "fr", label: "FR", name: "French" },
  { code: "es", label: "ES", name: "Spanish" },
];
