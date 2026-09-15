/**
 * Time units in milliseconds. Every duration in the app is a number of these, and
 * this is the one place the multiplication is written out.
 */

export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;
