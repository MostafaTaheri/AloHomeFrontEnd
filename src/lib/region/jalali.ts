/**
 * Jalali (Solar Hijri) <-> Gregorian conversion, used for date entry and for turning API period
 * labels such as "1405-02" into a real date. Display formatting itself is left to Intl.
 *
 * Port of the widely used 33-year-cycle algorithm (jalaali-js, MIT). Valid for Jalali years
 * -61..3177.
 */

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
] as const;

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

export interface JalaliDate {
  year: number;
  month: number;
  day: number;
}

export interface GregorianDate {
  year: number;
  month: number;
  day: number;
}

function jalCal(jy: number) {
  const gy = jy + 621;
  let leapJ = -14;
  let jp: number = BREAKS[0];
  let jump = 0;
  if (jy < BREAKS[0] || jy >= BREAKS[BREAKS.length - 1]!) {
    throw new RangeError(`Invalid Jalali year ${jy}`);
  }
  for (let i = 1; i < BREAKS.length; i += 1) {
    const jm = BREAKS[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): GregorianDate {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const day = div(mod(i, 153), 5) + 1;
  const month = mod(div(i, 153), 12) + 1;
  const year = div(j, 1461) - 100100 + div(8 - month, 6);
  return { year, month, day };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): JalaliDate {
  const gy = d2g(jdn).year;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      return { year: jy, month: 1 + div(k, 31), day: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { year: jy, month: 7 + div(k, 30), day: mod(k, 30) + 1 };
}

export function toJalali(gy: number, gm: number, gd: number): JalaliDate {
  return d2j(g2d(gy, gm, gd));
}

export function toGregorian(jy: number, jm: number, jd: number): GregorianDate {
  return d2g(j2d(jy, jm, jd));
}

export function isJalaliLeapYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

export function isValidJalali(jy: number, jm: number, jd: number): boolean {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return false;
  if (jy < -61 || jy >= 3177 || jm < 1 || jm > 12 || jd < 1) return false;
  return jd <= jalaliMonthLength(jy, jm);
}

/** "yyyy-MM-dd" for a Gregorian date, zero padded. */
export function toIsoDate(date: GregorianDate): string {
  const p = (n: number, w: number) => String(n).padStart(w, "0");
  return `${p(date.year, 4)}-${p(date.month, 2)}-${p(date.day, 2)}`;
}

export function parseIsoDate(value: string | null | undefined): GregorianDate | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}
