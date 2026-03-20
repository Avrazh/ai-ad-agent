// To add a new language: add one entry to TRANSLATION_TARGETS. Nothing else changes.
export type TranslationLangCode = "sv" | "de" | "fr" | "es";

export const TRANSLATION_TARGETS: {
  code: TranslationLangCode;
  label: string;
  name: string;
}[] = [
  { code: "sv", label: "SE", name: "Swedish" },
  { code: "de", label: "DE", name: "German" },
  { code: "fr", label: "FR", name: "French" },
  { code: "es", label: "ES", name: "Spanish" },
];
