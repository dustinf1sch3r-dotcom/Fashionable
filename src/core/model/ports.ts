/**
 * Ports through which `src/core` receives time and identifiers. Core never reads the system clock
 * or generates randomness itself; services provide real implementations, tests provide fakes.
 */

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  /** A fresh UUID v4. */
  uuid(): string;
}
