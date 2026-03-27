/**
 * Seeded random number generator for Fork: A Chronicle of Alternate Histories
 * Uses a simple LCG (Linear Congruential Generator) for reproducibility
 */

export class SeededRandom {
  private seed: number;

  constructor(seed: string | number) {
    // Convert string seed to number using a simple hash
    if (typeof seed === 'string') {
      this.seed = this.hashString(seed);
    } else {
      this.seed = seed;
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate next random number between 0 (inclusive) and 1 (exclusive)
   * Uses LCG algorithm with parameters from Numerical Recipes
   */
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  /**
   * Generate random integer between min (inclusive) and max (inclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Generate random float between min (inclusive) and max (exclusive)
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Shuffle array in place using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Pick a random element from an array
   */
  choice<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }

  /**
   * Pick a random element from an array using weighted probabilities
   * @param array - Array of elements to choose from
   * @param weights - Array of weights (same length as array)
   */
  weightedChoice<T>(array: T[], weights: number[]): T {
    if (array.length !== weights.length) {
      throw new Error("Array and weights must have the same length");
    }

    if (array.length === 0) {
      throw new Error("Cannot choose from empty array");
    }

    // Calculate total weight
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // Generate random value between 0 and totalWeight
    let random = this.next() * totalWeight;

    // Select element based on cumulative weights
    for (let i = 0; i < array.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return array[i];
      }
    }

    // Fallback (should never happen due to floating point precision)
    return array[array.length - 1];
  }
}
