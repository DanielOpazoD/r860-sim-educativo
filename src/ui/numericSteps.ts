import type { SettingRule } from '../domain/settingRules';
import { gridValues, stepDisplayValue } from '../domain/validation';

function displayText(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)));
}

export function stepInputValue(rule: SettingRule, raw: string, direction: 1 | -1): string {
  const values = gridValues(rule);
  const min = values[0] ?? 0;
  if (!raw.trim()) return direction > 0 || !rule.allowOff ? displayText(min, rule.decimals) : '';
  const current = Number(raw);
  if (!Number.isFinite(current)) return displayText(min, rule.decimals);
  if (rule.allowOff && direction < 0 && Math.abs(current - min) < 1e-6) return '';
  return displayText(stepDisplayValue(rule, current, direction), rule.decimals);
}

export function ruleRangeIndex(rule: SettingRule, current: number | 'off'): number {
  if (current === 'off') return 0;
  const values = gridValues(rule);
  const index = values.findIndex((value) => Math.abs(value - current) < 1e-6);
  return Math.max(index, 0) + (rule.allowOff ? 1 : 0);
}

export function ruleRangeValue(rule: SettingRule, index: number): number | 'off' {
  if (rule.allowOff && index === 0) return 'off';
  const values = gridValues(rule);
  return values[Math.max(0, index - (rule.allowOff ? 1 : 0))] ?? values[values.length - 1] ?? 0;
}
