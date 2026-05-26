import { useMemo } from "react";

const TEMPLATE_REGEX = /\$\{(\w+)\}/g;

export function resolveTemplate(template: string, data: Record<string, unknown>): string {
  if (!template || !data) return template;
  return template.replace(TEMPLATE_REGEX, (match, key: string) => {
    const value = data[key];
    if (value === undefined || value === null) return match;
    if (typeof value === "number") {
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    }
    return String(value);
  });
}

export function extractTemplateVariables(template: string): string[] {
  const vars: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(TEMPLATE_REGEX.source, "g");
  while ((match = regex.exec(template)) !== null) {
    if (!vars.includes(match[1])) {
      vars.push(match[1]);
    }
  }
  return vars;
}

export function useTextDataBinding(
  dataTemplate: string | undefined,
  content: string,
  boundData: Record<string, unknown>,
): string {
  return useMemo(() => {
    if (!dataTemplate) return content;
    return resolveTemplate(dataTemplate, boundData);
  }, [dataTemplate, content, boundData]);
}
