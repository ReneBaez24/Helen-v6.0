import React, { useState, useEffect, useCallback } from 'react';
import { GlassModal } from '../glass/GlassModal';
import { REMINDER_CATEGORIES, getCategory, reminderService } from '../../services/reminderService';
import { dateToKey, keyToDate } from '../../utils/mexicanHolidays';
import { formatShortDate } from './calendarFormat';
import './ReminderModal.css';

const DEFAULT_TIME = { hour: 9, minute: 0, period: 'a.m.' };

/** "HH:MM" (24h) -> { hour, minute, period } (12h) */
const to12h = (time) => {
    if (!time) return { ...DEFAULT_TIME };
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'p.m.' : 'a.m.';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return { hour, minute: m, period };
};

/** { hour, minute, period } (12h) -> "HH:MM" (24h) */
const to24h = ({ hour, minute, period }) => {
    let h = hour % 12;
    if (period === 'p.m.') h += 12;
    return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

/**
 * ReminderModal - Add / edit a calendar reminder.
 * Touch-first: date stepper, time spinners and category chips, so no keyboard
 * is required (title text is optional).
 *
 * Props:
 * - isOpen, onClose
 * - reminder: existing reminder to edit, or null to create
 * - initialDate: 'YYYY-MM-DD' used when creating
 * - onSave(data): async, may throw Error with user-facing message
 */
export const ReminderModal = ({ isOpen, onClose, reminder, initialDate, onSave }) => {
    const [date, setDate] = useState(initialDate);
    const [allDay, setAllDay] = useState(true);
    const [time, setTime] = useState(DEFAULT_TIME);
    const [category, setCategory] = useState('general');
    const [title, setTitle] = useState('');
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    // Reset form every time the modal opens
    useEffect(() => {
        if (!isOpen) return;
        if (reminder) {
            setDate(reminder.date);
            setAllDay(!reminder.time);
            setTime(to12h(reminder.time));
            setCategory(reminder.category);
            // Don't prefill the title when it's just the category default
            setTitle(reminder.title === getCategory(reminder.category).label ? '' : reminder.title);
        } else {
            const today = reminderService.todayKey();
            setDate(initialDate && initialDate >= today ? initialDate : today);
            setAllDay(true);
            setTime({ ...DEFAULT_TIME });
            setCategory('general');
            setTitle('');
        }
        setError(null);
        setSaving(false);
    }, [isOpen, reminder, initialDate]);

    const todayKey = reminderService.todayKey();
    const canGoBack = date > todayKey;

    const shiftDate = useCallback((days) => {
        setDate(prev => {
            const d = keyToDate(prev);
            d.setDate(d.getDate() + days);
            const next = dateToKey(d);
            return next < reminderService.todayKey() ? prev : next;
        });
    }, []);

    const changeHour = useCallback((delta) => {
        setTime(prev => {
            let hour = prev.hour + delta;
            if (hour > 12) hour = 1;
            if (hour < 1) hour = 12;
            return { ...prev, hour };
        });
    }, []);

    const changeMinute = useCallback((delta) => {
        setTime(prev => ({ ...prev, minute: (prev.minute + delta + 60) % 60 }));
    }, []);

    const togglePeriod = useCallback(() => {
        setTime(prev => ({ ...prev, period: prev.period === 'a.m.' ? 'p.m.' : 'a.m.' }));
    }, []);

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        setError(null);
        try {
            await onSave({
                ...(reminder?.id ? { id: reminder.id } : {}),
                date,
                time: allDay ? null : to24h(time),
                category,
                title: title.trim(),
            });
            onClose();
        } catch (err) {
            setError(err.message || 'Error al guardar el recordatorio');
            setSaving(false);
        }
    };

    return (
        <GlassModal isOpen={isOpen} onClose={onClose} size="medium" showCloseButton={false}>
            <div className="reminder-modal">
                {/* Header */}
                <div className="reminder-modal__header">
                    <button className="reminder-modal__btn" onClick={onClose} aria-label="Cancelar" type="button">
                        <span className="material-icons-outlined">close</span>
                    </button>
                    <h2 className="reminder-modal__title">
                        {reminder ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}
                    </h2>
                    <button
                        className="reminder-modal__btn reminder-modal__btn--save"
                        onClick={handleSave}
                        disabled={saving}
                        aria-label="Guardar"
                        type="button"
                    >
                        <span className="material-icons-outlined">check</span>
                    </button>
                </div>

                <div className="reminder-modal__body">
                    {/* LEFT: date + time */}
                    <div className="reminder-modal__column">
                        <label className="reminder-modal__label">Fecha</label>
                        <div className="reminder-modal__date">
                            <button
                                className="reminder-modal__step"
                                onClick={() => shiftDate(-1)}
                                disabled={!canGoBack}
                                aria-label="Día anterior"
                                type="button"
                            >
                                <span className="material-icons-outlined">chevron_left</span>
                            </button>
                            <span className="reminder-modal__date-value">{formatShortDate(date)}</span>
                            <button
                                className="reminder-modal__step"
                                onClick={() => shiftDate(1)}
                                aria-label="Día siguiente"
                                type="button"
                            >
                                <span className="material-icons-outlined">chevron_right</span>
                            </button>
                        </div>

                        <div className="reminder-modal__allday">
                            <span className="reminder-modal__label">Todo el día</span>
                            <button
                                className={`reminder-modal__switch ${allDay ? 'reminder-modal__switch--on' : ''}`}
                                onClick={() => setAllDay(v => !v)}
                                aria-label={allDay ? 'Asignar hora' : 'Todo el día'}
                                aria-pressed={allDay}
                                type="button"
                            >
                                <span className="reminder-modal__switch-thumb" />
                            </button>
                        </div>

                        <div className={`reminder-modal__time ${allDay ? 'reminder-modal__time--disabled' : ''}`}>
                            <div className="reminder-modal__spinner">
                                <button className="reminder-modal__arrow" onClick={() => changeHour(1)} disabled={allDay} aria-label="Incrementar hora" type="button">
                                    <span className="material-icons-outlined">expand_less</span>
                                </button>
                                <div className="reminder-modal__time-value">{String(time.hour).padStart(2, '0')}</div>
                                <button className="reminder-modal__arrow" onClick={() => changeHour(-1)} disabled={allDay} aria-label="Decrementar hora" type="button">
                                    <span className="material-icons-outlined">expand_more</span>
                                </button>
                            </div>
                            <span className="reminder-modal__separator">:</span>
                            <div className="reminder-modal__spinner">
                                <button className="reminder-modal__arrow" onClick={() => changeMinute(5)} disabled={allDay} aria-label="Incrementar minutos" type="button">
                                    <span className="material-icons-outlined">expand_less</span>
                                </button>
                                <div className="reminder-modal__time-value">{String(time.minute).padStart(2, '0')}</div>
                                <button className="reminder-modal__arrow" onClick={() => changeMinute(-5)} disabled={allDay} aria-label="Decrementar minutos" type="button">
                                    <span className="material-icons-outlined">expand_more</span>
                                </button>
                            </div>
                            <button className="reminder-modal__period" onClick={togglePeriod} disabled={allDay} aria-label="Cambiar período" type="button">
                                {time.period}
                            </button>
                        </div>
                    </div>

                    {/* RIGHT: category + title */}
                    <div className="reminder-modal__column">
                        <label className="reminder-modal__label">Tipo</label>
                        <div className="reminder-modal__categories">
                            {REMINDER_CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    className={`reminder-modal__category ${category === cat.id ? 'reminder-modal__category--active' : ''}`}
                                    onClick={() => setCategory(cat.id)}
                                    aria-pressed={category === cat.id}
                                    title={cat.label}
                                    type="button"
                                >
                                    <span className="material-symbols-outlined">{cat.icon}</span>
                                    <span className="reminder-modal__category-label">{cat.short || cat.label}</span>
                                </button>
                            ))}
                        </div>

                        <label className="reminder-modal__label" htmlFor="reminder-title">Título (opcional)</label>
                        <input
                            id="reminder-title"
                            className="reminder-modal__input"
                            type="text"
                            maxLength={60}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={getCategory(category).label}
                        />
                    </div>
                </div>

                {error && (
                    <p className="reminder-modal__error" role="alert">
                        <span className="material-icons-outlined">error</span>
                        {error}
                    </p>
                )}
            </div>
        </GlassModal>
    );
};
