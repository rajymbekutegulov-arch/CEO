import geography from './geography.js';
import math from './math.js';
import history from './history.js';

const subjects = [geography, math, history];

/** Fresh deep copy of the starter curriculum (safe to mutate). */
export function seedContent() {
  return structuredClone(subjects);
}
