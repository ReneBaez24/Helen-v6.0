/**
 * Mexican holidays utility
 *
 * Computes the holidays shown (highlighted) in the Calendar screen for any year.
 *
 * Two categories:
 * - OFFICIAL: "Días de descanso obligatorio" from Article 74 of the Ley Federal
 *   del Trabajo (LFT). Some of them are moved to a Monday by law.
 * - CIVIC: Widely observed civic, cultural and religious dates that are NOT
 *   mandatory rest days (Día de Muertos, Semana Santa, Día de las Madres, etc.)
 *
 * Note: LFT Art. 74 fraction IX (federal/local election day) is not computed
 * here because it depends on the electoral laws for each specific election.
 *
 * All dates are handled as local "YYYY-MM-DD" keys to avoid UTC off-by-one bugs.
 */

export const HOLIDAY_TYPES = {
    OFFICIAL: 'official',
    CIVIC: 'civic',
};

/**
 * Build a local date key "YYYY-MM-DD"
 * @param {number} year
 * @param {number} monthIndex - 0-based month
 * @param {number} day
 */
export const toDateKey = (year, monthIndex, day) => (
    `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

/** Date object -> "YYYY-MM-DD" using LOCAL time */
export const dateToKey = (date) => toDateKey(date.getFullYear(), date.getMonth(), date.getDate());

/** "YYYY-MM-DD" -> Date at local midnight */
export const keyToDate = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
};

/**
 * Day of month of the Nth given weekday in a month
 * @param {number} year
 * @param {number} monthIndex - 0-based month
 * @param {number} weekday - 0 = Sunday ... 6 = Saturday
 * @param {number} n - 1 = first, 2 = second, 3 = third ...
 */
const nthWeekdayOfMonth = (year, monthIndex, weekday, n) => {
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const offset = (weekday - firstWeekday + 7) % 7;
    return 1 + offset + (n - 1) * 7;
};

/**
 * Easter Sunday (Gregorian calendar) - Anonymous Gregorian algorithm
 * @returns {Date} local date
 */
const easterSunday = (year) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
};

const addDays = (date, days) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
};

// Cache computed years (the calendar re-renders often, holidays never change)
const cache = new Map();

/**
 * Get every holiday for a year
 * @param {number} year
 * @returns {Array<{date: string, name: string, type: string}>} sorted by date
 */
export const getHolidaysForYear = (year) => {
    if (cache.has(year)) return cache.get(year);

    const OFFICIAL = HOLIDAY_TYPES.OFFICIAL;
    const CIVIC = HOLIDAY_TYPES.CIVIC;
    const easter = easterSunday(year);

    const holidays = [
        // --- LFT Article 74: días de descanso obligatorio ---
        { date: toDateKey(year, 0, 1), name: 'Año Nuevo', type: OFFICIAL },
        { date: toDateKey(year, 1, nthWeekdayOfMonth(year, 1, 1, 1)), name: 'Día de la Constitución', type: OFFICIAL },
        { date: toDateKey(year, 2, nthWeekdayOfMonth(year, 2, 1, 3)), name: 'Natalicio de Benito Juárez', type: OFFICIAL },
        { date: toDateKey(year, 4, 1), name: 'Día del Trabajo', type: OFFICIAL },
        { date: toDateKey(year, 8, 16), name: 'Día de la Independencia', type: OFFICIAL },
        { date: toDateKey(year, 10, nthWeekdayOfMonth(year, 10, 1, 3)), name: 'Día de la Revolución Mexicana', type: OFFICIAL },
        { date: toDateKey(year, 11, 25), name: 'Navidad', type: OFFICIAL },

        // --- Civic / cultural / religious dates (not mandatory rest days) ---
        { date: toDateKey(year, 0, 6), name: 'Día de Reyes', type: CIVIC },
        { date: toDateKey(year, 1, 14), name: 'Día del Amor y la Amistad', type: CIVIC },
        { date: toDateKey(year, 1, 24), name: 'Día de la Bandera', type: CIVIC },
        { date: dateToKey(addDays(easter, -3)), name: 'Jueves Santo', type: CIVIC },
        { date: dateToKey(addDays(easter, -2)), name: 'Viernes Santo', type: CIVIC },
        { date: toDateKey(year, 3, 30), name: 'Día del Niño', type: CIVIC },
        { date: toDateKey(year, 4, 5), name: 'Batalla de Puebla', type: CIVIC },
        { date: toDateKey(year, 4, 10), name: 'Día de las Madres', type: CIVIC },
        { date: toDateKey(year, 4, 15), name: 'Día del Maestro', type: CIVIC },
        { date: toDateKey(year, 5, 10), name: 'Día Nacional de la Lengua de Señas Mexicana', type: CIVIC },
        { date: toDateKey(year, 5, nthWeekdayOfMonth(year, 5, 0, 3)), name: 'Día del Padre', type: CIVIC },
        { date: toDateKey(year, 8, 23), name: 'Día Internacional de las Lenguas de Señas', type: CIVIC },
        { date: toDateKey(year, 10, 1), name: 'Día de Todos los Santos', type: CIVIC },
        { date: toDateKey(year, 10, 2), name: 'Día de Muertos', type: CIVIC },
        { date: toDateKey(year, 10, 20), name: 'Aniversario de la Revolución', type: CIVIC },
        { date: toDateKey(year, 11, 12), name: 'Día de la Virgen de Guadalupe', type: CIVIC },
        { date: toDateKey(year, 11, 24), name: 'Nochebuena', type: CIVIC },
        { date: toDateKey(year, 11, 31), name: 'Fin de Año', type: CIVIC },
    ];

    // LFT Art. 74 fraction VII: October 1st every six years
    // (transmission of the Federal Executive Power: 2024, 2030, 2036...)
    if (year >= 2024 && (year - 2024) % 6 === 0) {
        holidays.push({ date: toDateKey(year, 9, 1), name: 'Transmisión del Poder Ejecutivo Federal', type: OFFICIAL });
    }

    holidays.sort((a, b) => a.date.localeCompare(b.date));
    cache.set(year, holidays);
    return holidays;
};

/**
 * Holidays indexed by date key for fast lookup in the month grid
 * @param {number} year
 * @returns {Map<string, Array<{date, name, type}>>}
 */
export const getHolidayMapForYear = (year) => {
    const map = new Map();
    getHolidaysForYear(year).forEach((holiday) => {
        if (!map.has(holiday.date)) map.set(holiday.date, []);
        map.get(holiday.date).push(holiday);
    });
    return map;
};

/**
 * Holidays for a single date key
 * @param {string} dateKey - "YYYY-MM-DD"
 */
export const getHolidaysForDate = (dateKey) => {
    const year = Number(dateKey.slice(0, 4));
    return getHolidayMapForYear(year).get(dateKey) || [];
};
