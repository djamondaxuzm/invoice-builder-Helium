export const selectBillingRows = (
  visible: number[],
  selected: number[],
  clicked: number,
  anchor: number | undefined,
  modifiers: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; checkbox?: boolean }
): number[] => {
  if (modifiers.shiftKey && anchor !== undefined && visible.includes(anchor)) {
    const start = visible.indexOf(anchor);
    const end = visible.indexOf(clicked);
    const range = visible.slice(Math.min(start, end), Math.max(start, end) + 1);
    return modifiers.ctrlKey || modifiers.metaKey ? [...new Set([...selected, ...range])] : range;
  }
  if (modifiers.ctrlKey || modifiers.metaKey || modifiers.checkbox)
    return selected.includes(clicked) ? selected.filter(id => id !== clicked) : [...selected, clicked];
  return [clicked];
};
