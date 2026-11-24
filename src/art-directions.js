export const styles = ['doodle', 'oil', 'blueprint', 'paper', 'glass'];
export function resolveStyle(value) {
  return styles.includes(value) ? value : 'doodle';
}
