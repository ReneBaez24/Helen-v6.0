import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGestureNavigation } from '../contexts/gestureNavigationHooks';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { ReminderModal } from '../components/calendar/ReminderModal';
import {
    MONTH_NAMES,
    GRID_WEEKDAYS,
    formatLongDate,
    formatTime12h,
} from '../components/calendar/calendarFormat';
import { ROUTES } from '../config/constants';
import { reminderService, getCategory } from '../services/reminderService';
import {
    HOLIDAY_TYPES,
    getHolidayMapForYear,
    getHolidaysForDate,
    toDateKey,
    keyToDate,
} from '../utils/mexicanHolidays';
import './Calendar.css';

/**
 * Build the 6x7 month grid (Monday first).
 * Includes trailing/leading days of adjacent months so the grid never jumps in height.
 */
const buildMonthGrid = (year, monthIndex) => {
    const firstDay = new Date(year, monthIndex, 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7; // 0 = Monday
    const start = new Date(year, monthIndex, 1 - mondayOffset);

    return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        return {
            key: toDateKey(d.getFullYear(), d.getMonth(), d.getDate()),
            day: d.getDate(),
            inMonth: d.getMonth() === monthIndex,
            isWeekend: d.getDay() === 0 || d.getDay() === 6,
        };
    });
};

/**
 * Calendar Screen
 * - Month view with Mexican holidays highlighted (official LFT Art. 74 + civic dates)
 * - Reminders CRUD on today / future days (stored locally)
 *
 * Gestures (LSM):
 * - "calendario": opens this screen (global, see GESTURE_ACTIONS)
 * - "agregar": add reminder for the selected day
 * - "editar": toggle edit mode (edit / delete reminders)
 */
const Calendar = () => {
    const navigate = useNavigate();
    const { pendingModalGesture, clearPendingModal } = useGestureNavigation();

    const todayKey = reminderService.todayKey();
    const today = keyToDate(todayKey);

    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState(todayKey);
    const [reminders, setReminders] = useState([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReminder, setEditingReminder] = useState(null);
    const [error, setError] = useState(null);

    // ---------- Data ----------
    const loadReminders = useCallback(async () => {
        try {
            setReminders(await reminderService.getAll());
            setError(null);
        } catch (err) {
            console.error('Failed to load reminders:', err);
            setError('No se pudieron cargar los recordatorios');
        }
    }, []);

    useEffect(() => {
        loadReminders();
    }, [loadReminders]);

    // ---------- Derived data ----------
    const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

    // Holidays for every year visible in the grid (Dec/Jan edges)
    const holidayMap = useMemo(() => {
        const years = new Set(grid.map(cell => Number(cell.key.slice(0, 4))));
        const merged = new Map();
        years.forEach(y => getHolidayMapForYear(y).forEach((v, k) => merged.set(k, v)));
        return merged;
    }, [grid]);

    const remindersByDate = useMemo(() => {
        const map = new Map();
        reminders.forEach(r => {
            if (!map.has(r.date)) map.set(r.date, []);
            map.get(r.date).push(r);
        });
        return map;
    }, [reminders]);

    const selectedHolidays = getHolidaysForDate(selectedDate);
    const selectedReminders = remindersByDate.get(selectedDate) || [];
    const selectedIsEditable = selectedDate >= todayKey;

    // Upcoming holidays in the visible month (summary under the panel when nothing selected)
    const monthHolidayCount = useMemo(() => (
        grid.filter(c => c.inMonth && holidayMap.has(c.key)).length
    ), [grid, holidayMap]);

    // ---------- Navigation ----------
    const goToMonth = useCallback((delta) => {
        // Pure computation (no setter inside another setter's updater: StrictMode runs updaters twice)
        const target = new Date(viewYear, viewMonth + delta, 1);
        setViewYear(target.getFullYear());
        setViewMonth(target.getMonth());
    }, [viewYear, viewMonth]);

    const goToToday = useCallback(() => {
        const t = keyToDate(reminderService.todayKey());
        setViewYear(t.getFullYear());
        setViewMonth(t.getMonth());
        setSelectedDate(reminderService.todayKey());
    }, []);

    const handleSelectDay = useCallback((cell) => {
        setSelectedDate(cell.key);
        if (!cell.inMonth) {
            const d = keyToDate(cell.key);
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
        }
    }, []);

    // ---------- Actions ----------
    const handleClose = useCallback(() => navigate(ROUTES.HOME), [navigate]);

    const handleToggleEdit = useCallback(() => setIsEditMode(prev => !prev), []);

    const handleAdd = useCallback(() => {
        setEditingReminder(null);
        setIsModalOpen(true);
    }, []);

    const handleEditReminder = useCallback((reminder) => {
        if (reminder.date < reminderService.todayKey()) return; // past: delete only
        setEditingReminder(reminder);
        setIsModalOpen(true);
    }, []);

    const handleDeleteReminder = useCallback(async (id) => {
        try {
            await reminderService.delete(id);
            setReminders(prev => prev.filter(r => r.id !== id));
            setError(null);
        } catch (err) {
            console.error('Failed to delete reminder:', err);
            setError(err.message || 'Error al eliminar el recordatorio');
        }
    }, []);

    /** Called by the modal; throws so the modal can show the message */
    const handleSave = useCallback(async (data) => {
        const { id, ...fields } = data;
        const saved = id
            ? await reminderService.update(id, fields)
            : await reminderService.create(fields);

        await loadReminders();

        // Follow the reminder if its date changed / was created on another day
        setSelectedDate(saved.date);
        const d = keyToDate(saved.date);
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
    }, [loadReminders]);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setEditingReminder(null);
    }, []);

    // Exit edit mode when there is nothing left to edit
    useEffect(() => {
        if (isEditMode && selectedReminders.length === 0) setIsEditMode(false);
    }, [isEditMode, selectedReminders.length]);

    // ---------- LSM gesture actions ("agregar" / "editar") ----------
    useEffect(() => {
        if (!pendingModalGesture?.action) return;
        if (pendingModalGesture.action === 'add-item') {
            handleAdd();
            clearPendingModal();
        } else if (pendingModalGesture.action === 'edit-item') {
            if (selectedReminders.length > 0) handleToggleEdit();
            clearPendingModal();
        }
    }, [pendingModalGesture, handleAdd, handleToggleEdit, clearPendingModal, selectedReminders.length]);

    return (
        <div className="calendar-screen">
            <ScreenHeader
                title="Calendario"
                variant="enhanced"
                onClose={handleClose}
                onEdit={handleToggleEdit}
                onAdd={handleAdd}
                showEditButton={selectedReminders.length > 0}
                showAddButton
                isEditMode={isEditMode}
            />

            <div className="calendar-body">
                {/* ===== Month grid ===== */}
                <section className="calendar-month" aria-label="Calendario mensual">
                    <div className="calendar-month__nav">
                        <button className="calendar-month__nav-btn" onClick={() => goToMonth(-1)} aria-label="Mes anterior" type="button">
                            <span className="material-icons-outlined">chevron_left</span>
                        </button>
                        <h2 className="calendar-month__title">
                            {MONTH_NAMES[viewMonth]} <span className="calendar-month__year">{viewYear}</span>
                        </h2>
                        <button className="calendar-month__nav-btn" onClick={() => goToMonth(1)} aria-label="Mes siguiente" type="button">
                            <span className="material-icons-outlined">chevron_right</span>
                        </button>
                        <button className="calendar-month__today-btn" onClick={goToToday} type="button">
                            Hoy
                        </button>
                    </div>

                    <div className="calendar-grid" role="grid">
                        {GRID_WEEKDAYS.map((wd, i) => (
                            <div key={`wd-${i}`} className={`calendar-grid__weekday ${i >= 5 ? 'calendar-grid__weekday--weekend' : ''}`}>
                                {wd}
                            </div>
                        ))}

                        {grid.map(cell => {
                            const holidays = holidayMap.get(cell.key) || [];
                            const isOfficial = holidays.some(h => h.type === HOLIDAY_TYPES.OFFICIAL);
                            const isCivic = !isOfficial && holidays.length > 0;
                            const reminderCount = remindersByDate.get(cell.key)?.length || 0;

                            const classes = [
                                'calendar-day',
                                !cell.inMonth && 'calendar-day--outside',
                                cell.key < todayKey && 'calendar-day--past',
                                cell.isWeekend && 'calendar-day--weekend',
                                isOfficial && 'calendar-day--official',
                                isCivic && 'calendar-day--civic',
                                cell.key === todayKey && 'calendar-day--today',
                                cell.key === selectedDate && 'calendar-day--selected',
                            ].filter(Boolean).join(' ');

                            return (
                                <button
                                    key={cell.key}
                                    className={classes}
                                    onClick={() => handleSelectDay(cell)}
                                    aria-label={`${formatLongDate(cell.key)}${holidays.length ? `, ${holidays.map(h => h.name).join(', ')}` : ''}${reminderCount ? `, ${reminderCount} recordatorio(s)` : ''}`}
                                    aria-pressed={cell.key === selectedDate}
                                    type="button"
                                >
                                    <span className="calendar-day__number">{cell.day}</span>
                                    {reminderCount > 0 && <span className="calendar-day__dot" aria-hidden="true" />}
                                </button>
                            );
                        })}
                    </div>

                    <div className="calendar-legend" aria-hidden="true">
                        <span className="calendar-legend__item"><span className="calendar-legend__swatch calendar-legend__swatch--official" />Feriado oficial</span>
                        <span className="calendar-legend__item"><span className="calendar-legend__swatch calendar-legend__swatch--civic" />Día conmemorativo</span>
                        <span className="calendar-legend__item"><span className="calendar-legend__swatch calendar-legend__swatch--reminder" />Recordatorio</span>
                    </div>
                </section>

                {/* ===== Selected day panel ===== */}
                <section className="calendar-day-panel" aria-live="polite">
                    <div className="calendar-day-panel__header">
                        <h3 className="calendar-day-panel__date">{formatLongDate(selectedDate)}</h3>
                        {selectedDate === todayKey && <span className="calendar-day-panel__today">Hoy</span>}
                    </div>

                    {selectedHolidays.length > 0 && (
                        <div className="calendar-day-panel__holidays">
                            {selectedHolidays.map(h => (
                                <div key={h.name} className={`calendar-holiday calendar-holiday--${h.type}`}>
                                    <span className="material-symbols-outlined">
                                        {h.type === HOLIDAY_TYPES.OFFICIAL ? 'celebration' : 'flag'}
                                    </span>
                                    <div className="calendar-holiday__text">
                                        <span className="calendar-holiday__name">{h.name}</span>
                                        <span className="calendar-holiday__type">
                                            {h.type === HOLIDAY_TYPES.OFFICIAL ? 'Día de descanso obligatorio' : 'Día conmemorativo'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {error && (
                        <p className="calendar-day-panel__error" role="alert">
                            <span className="material-icons-outlined">error</span>{error}
                        </p>
                    )}

                    <div className="calendar-reminders">
                        {selectedReminders.length === 0 ? (
                            <div className="calendar-reminders__empty">
                                <span className="material-symbols-outlined calendar-reminders__empty-icon">event_available</span>
                                <p className="calendar-reminders__empty-text">
                                    {selectedIsEditable
                                        ? 'Sin recordatorios'
                                        : 'Sin recordatorios en este día'}
                                </p>
                                {!selectedHolidays.length && monthHolidayCount > 0 && (
                                    <p className="calendar-reminders__hint">
                                        {monthHolidayCount} día(s) festivo(s) este mes
                                    </p>
                                )}
                            </div>
                        ) : (
                            selectedReminders.map(r => {
                                const cat = getCategory(r.category);
                                const isPast = r.date < todayKey;
                                return (
                                    <div
                                        key={r.id}
                                        className={`calendar-reminder ${isPast ? 'calendar-reminder--past' : ''} ${isEditMode && !isPast ? 'calendar-reminder--editable' : ''}`}
                                        onClick={isEditMode ? () => handleEditReminder(r) : undefined}
                                        role={isEditMode && !isPast ? 'button' : undefined}
                                        tabIndex={isEditMode && !isPast ? 0 : undefined}
                                    >
                                        <span className="material-symbols-outlined calendar-reminder__icon">{cat.icon}</span>
                                        <div className="calendar-reminder__content">
                                            <span className="calendar-reminder__title">{r.title}</span>
                                            <span className="calendar-reminder__time">{formatTime12h(r.time)}</span>
                                        </div>
                                        {isEditMode && (
                                            <div className="calendar-reminder__actions">
                                                {!isPast && (
                                                    <button
                                                        className="calendar-reminder__btn"
                                                        onClick={(e) => { e.stopPropagation(); handleEditReminder(r); }}
                                                        aria-label="Editar recordatorio"
                                                        type="button"
                                                    >
                                                        <span className="material-symbols-outlined">edit</span>
                                                    </button>
                                                )}
                                                <button
                                                    className="calendar-reminder__btn calendar-reminder__btn--delete"
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteReminder(r.id); }}
                                                    aria-label="Eliminar recordatorio"
                                                    type="button"
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {selectedIsEditable ? (
                        <button className="calendar-day-panel__add" onClick={handleAdd} type="button">
                            <span className="material-icons-outlined">add</span>
                            Agregar recordatorio
                        </button>
                    ) : (
                        <p className="calendar-day-panel__note">
                            <span className="material-icons-outlined">info</span>
                            Solo se pueden agregar recordatorios a partir de hoy
                        </p>
                    )}
                </section>
            </div>

            <ReminderModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                reminder={editingReminder}
                initialDate={selectedDate}
                onSave={handleSave}
            />
        </div>
    );
};

export default Calendar;
