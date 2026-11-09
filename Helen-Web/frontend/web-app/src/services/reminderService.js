/**
 * Reminder service: CRUD for calendar reminders
 * WEB VERSION - Uses localStorage (same approach as alarmService / deviceService)
 *
 * Reminder shape:
 * {
 *   id: string,
 *   date: 'YYYY-MM-DD',          // local date
 *   time: 'HH:MM' | null,        // 24h, null = all day
 *   category: string,            // one of REMINDER_CATEGORIES ids
 *   title: string,
 *   createdAt: ISO string,
 *   updatedAt?: ISO string
 * }
 *
 * Rule: reminders can only be created (or moved) on today or future days.
 */

import { dateToKey } from '../utils/mexicanHolidays';

const STORAGE_KEY = 'reminders';

export const MAX_REMINDERS_PER_DAY = 10;

export const REMINDER_CATEGORIES = [
    { id: 'general', label: 'Recordatorio', short: 'General', icon: 'notifications' },
    { id: 'medical', label: 'Cita médica', icon: 'medical_services' },
    { id: 'medicine', label: 'Medicamento', short: 'Medicina', icon: 'medication' },
    { id: 'birthday', label: 'Cumpleaños', icon: 'cake' },
    { id: 'meeting', label: 'Reunión', icon: 'groups' },
    { id: 'payment', label: 'Pago', icon: 'payments' },
    { id: 'school', label: 'Escuela', icon: 'school' },
    { id: 'other', label: 'Otro', icon: 'event' },
];

export const getCategory = (id) => (
    REMINDER_CATEGORIES.find(c => c.id === id) || REMINDER_CATEGORIES[0]
);

class EventEmitter {
    constructor() {
        this.events = {};
    }
    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    }
    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
    emit(event, ...args) {
        if (!this.events[event]) return;
        this.events[event].forEach(cb => cb(...args));
    }
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Sort by date, then all-day first, then by time */
const compareReminders = (a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (!a.time && b.time) return -1;
    if (a.time && !b.time) return 1;
    return (a.time || '').localeCompare(b.time || '');
};

class ReminderService extends EventEmitter {
    generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /** Today's local date key */
    todayKey() {
        return dateToKey(new Date());
    }

    /** True when the date key is today or in the future */
    isEditableDate(dateKey) {
        return dateKey >= this.todayKey();
    }

    load() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            const parsed = stored ? JSON.parse(stored) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Error loading reminders:', e);
            return [];
        }
    }

    save(reminders) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
        } catch (e) {
            console.error('Error saving reminders:', e);
            throw new Error('No se pudo guardar el recordatorio');
        }
    }

    /**
     * Validate & normalize reminder input
     * @throws {Error} with user-facing Spanish message
     */
    validate(data, { excludeId = null } = {}) {
        const date = data.date;
        if (!date || !DATE_REGEX.test(date)) {
            throw new Error('Fecha inválida');
        }
        if (!this.isEditableDate(date)) {
            throw new Error('Solo puedes agregar recordatorios para hoy o días futuros');
        }

        const time = data.time ?? null;
        if (time !== null && !TIME_REGEX.test(time)) {
            throw new Error('Hora inválida');
        }

        const category = getCategory(data.category).id;
        const title = (data.title || '').trim().slice(0, 60) || getCategory(category).label;

        const sameDay = this.load().filter(r => r.date === date && r.id !== excludeId);
        if (sameDay.length >= MAX_REMINDERS_PER_DAY) {
            throw new Error(`Máximo de ${MAX_REMINDERS_PER_DAY} recordatorios por día`);
        }

        return { date, time, category, title };
    }

    // ---------- CRUD ----------

    /** READ: all reminders (sorted) */
    async getAll() {
        return this.load().sort(compareReminders);
    }

    /** READ: one reminder */
    async getById(id) {
        return this.load().find(r => r.id === id) || null;
    }

    /** READ: reminders for one day */
    async getByDate(dateKey) {
        return this.load().filter(r => r.date === dateKey).sort(compareReminders);
    }

    /** READ: reminders in a month (monthIndex 0-based) */
    async getByMonth(year, monthIndex) {
        const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
        return this.load().filter(r => r.date.startsWith(prefix)).sort(compareReminders);
    }

    /** CREATE */
    async create(data) {
        const valid = this.validate(data);
        const reminder = {
            id: this.generateId(),
            ...valid,
            createdAt: new Date().toISOString(),
        };

        const reminders = this.load();
        reminders.push(reminder);
        this.save(reminders);
        this.emit('reminder:created', reminder);
        return reminder;
    }

    /** UPDATE */
    async update(id, updates) {
        const reminders = this.load();
        const index = reminders.findIndex(r => r.id === id);
        if (index === -1) {
            throw new Error('Recordatorio no encontrado');
        }

        const merged = { ...reminders[index], ...updates };
        const valid = this.validate(merged, { excludeId: id });

        reminders[index] = {
            ...reminders[index],
            ...valid,
            updatedAt: new Date().toISOString(),
        };
        this.save(reminders);
        this.emit('reminder:updated', reminders[index]);
        return reminders[index];
    }

    /** DELETE (allowed for past reminders too, to clean up) */
    async delete(id) {
        const reminders = this.load();
        const filtered = reminders.filter(r => r.id !== id);
        if (filtered.length === reminders.length) {
            throw new Error('Recordatorio no encontrado');
        }
        this.save(filtered);
        this.emit('reminder:deleted', id);
        return true;
    }
}

export const reminderService = new ReminderService();
export default reminderService;
