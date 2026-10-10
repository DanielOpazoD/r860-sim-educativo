export function setSegmentedValue(groupId: string, value: string): void {
  const group = document.getElementById(groupId);
  const selected = [...(group?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? [])].find((input) => input.value === value);
  if (selected) selected.checked = true;
}

export function segmentedValue(groupId: string): string | null {
  return document.getElementById(groupId)?.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.value ?? null;
}
