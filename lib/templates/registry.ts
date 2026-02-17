import type { TemplateDefinition, TemplateId, AdSpec, PixelRect } from "@/lib/types";
import type { ReactElement } from "react";

export type TemplateBuildFn = (
  spec: AdSpec,
  imageBase64: string,
  zonePx: PixelRect
) => ReactElement;

type RegisteredTemplate = TemplateDefinition & {
  build: TemplateBuildFn;
};

const templates = new Map<TemplateId, RegisteredTemplate>();

export function registerTemplate(
  def: TemplateDefinition,
  build: TemplateBuildFn
) {
  templates.set(def.id, { ...def, build });
}

export function getTemplate(id: TemplateId): RegisteredTemplate {
  const t = templates.get(id);
  if (!t) throw new Error(`Template "${id}" not registered`);
  return t;
}

export function getAllTemplates(): RegisteredTemplate[] {
  return Array.from(templates.values());
}

export function getTemplateIds(): TemplateId[] {
  return Array.from(templates.keys());
}
