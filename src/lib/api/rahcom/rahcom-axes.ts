const axisPalette = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#d97706', '#0891b2', '#db2777', '#475569', '#0f766e', '#be123c', '#7c3aed'];

export function rahcomAxisColor(axis: string, axes: string[]) {
  const index = axes.indexOf(axis);
  return axisPalette[(index < 0 ? 0 : index) % axisPalette.length];
}
