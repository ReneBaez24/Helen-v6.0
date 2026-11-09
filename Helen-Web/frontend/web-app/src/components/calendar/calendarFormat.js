/**
 * Spanish (es-MX) date/time formatting helpers for the Calendar screen.
 * Implemented manually (no Intl dependency) so output is identical on every
 * device, including the Raspberry Pi kiosk.
 */
import { keyToDate } from '../../utils/mexicanHolidays';

export const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Index = Date.getDay() (0 = Sunday)
export const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Grid header, Monday first (same order as the Alarms day selector)
export const GRID_WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** "Lunes, 9 de noviembre" */
export const formatLongDate = (dateKey) => {
    const d = keyToDate(dateKey);
    return `${WEEKDAY_NAMES[d.getDay()]}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()].toLowerCase()}`;
};

/** "Lun 9 nov 2026" */
export const formatShortDate = (dateKey) => {
    const d = keyToDate(dateKey);
    return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

/** "HH:MM" (24h) -> "9:05 a.m." */
export const formatTime12h = (time) => {
    if (!time) return 'Todo el día';
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'p.m.' : 'a.m.';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};
