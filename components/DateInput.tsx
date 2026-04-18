
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatVNDate, toISODateKey, parseVNDate } from '../utils/date';

interface DateInputProps {
  value: string;
  onChange: (isoValue: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, label, placeholder, className = '', icon, disabled }) => {
  const [displayText, setDisplayText] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 280 });
  const [isInvalid, setIsInvalid] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayText(formatVNDate(value));
    const parsed = parseVNDate(value);
    if (parsed) setViewDate(parsed);
  }, [value]);

  const updatePopoverPos = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const popoverHeight = 320;
      let top = rect.bottom + window.scrollY + 8;
      if (rect.bottom + popoverHeight > viewportHeight) {
        top = rect.top + window.scrollY - popoverHeight - 8;
      }
      setPopoverPos({ top, left: rect.left + window.scrollX, width: Math.max(rect.width, 280) });
    }
  };

  useEffect(() => {
    if (isCalendarOpen) {
      updatePopoverPos();
      const handler = () => updatePopoverPos();
      window.addEventListener('scroll', handler, true);
      window.addEventListener('resize', handler);
      return () => {
        window.removeEventListener('scroll', handler, true);
        window.removeEventListener('resize', handler);
      };
    }
  }, [isCalendarOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const portal = document.getElementById('calendar-portal-root');
      if (containerRef.current?.contains(e.target as Node) || portal?.contains(e.target as Node)) return;
      setIsCalendarOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^\d/]/g, '');
    const caret = e.target.selectionStart || 0;
    
    // Mask logic
    let digits = val.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    if (digits.length > 4) formatted = formatted.slice(0, 5) + '/' + digits.slice(4);
    
    setDisplayText(formatted);

    // Natural caret handling
    setTimeout(() => {
      if (inputRef.current) {
        let nextCaret = caret;
        if (formatted.length > val.length && formatted[caret - 1] === '/') nextCaret++;
        inputRef.current.setSelectionRange(nextCaret, nextCaret);
      }
    }, 0);
  };

  const handleBlur = () => {
    if (!displayText) {
      onChange('');
      setIsInvalid(false);
      return;
    }
    const parsed = parseVNDate(displayText);
    if (parsed) {
      onChange(toISODateKey(parsed));
      setIsInvalid(false);
    } else {
      setIsInvalid(true);
    }
  };

  const daysInMonth = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Mon start
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let i = 1; i <= lastDate; i++) days.push(new Date(year, month, i));
    return days;
  }, [viewDate]);

  const calendarPopover = isCalendarOpen && createPortal(
    <div id="calendar-portal-root" className="fixed z-[99999] bg-white border border-blue-100 rounded-3xl shadow-2xl p-5 animate-in fade-in zoom-in duration-200" style={{ top: popoverPos.top, left: popoverPos.left, width: popoverPos.width, minWidth: '280px' }}>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-2 hover:bg-blue-50 rounded-xl text-blue-600"><ChevronLeft size={20} /></button>
        <div className="font-extrabold text-blue-900 text-sm uppercase tracking-wider">Tháng {viewDate.getMonth() + 1} {viewDate.getFullYear()}</div>
        <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-2 hover:bg-blue-50 rounded-xl text-blue-600"><ChevronRight size={20} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => <div key={d} className="text-[10px] font-black text-blue-300 uppercase py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {daysInMonth.map((d, i) => d ? (
          <button key={i} onClick={() => { onChange(toISODateKey(d)); setIsCalendarOpen(false); setIsInvalid(false); }} className={`h-9 w-full flex items-center justify-center rounded-xl text-xs font-bold transition-all ${toISODateKey(d) === toISODateKey(value) ? 'bg-blue-600 text-white shadow-lg scale-105' : toISODateKey(d) === toISODateKey(new Date()) ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'text-gray-600 hover:bg-blue-50 hover:text-blue-900'}`}>{d.getDate()}</button>
        ) : <div key={i} className="h-9" />)}
      </div>
      <div className="mt-5 pt-4 border-t border-blue-50 flex justify-between">
        <button onClick={() => { onChange(toISODateKey(new Date())); setIsCalendarOpen(false); }} className="text-[10px] font-black text-blue-600 uppercase hover:underline">Hôm nay</button>
        <button onClick={() => setIsCalendarOpen(false)} className="text-[10px] font-black text-gray-400 uppercase hover:underline">Đóng</button>
      </div>
    </div>,
    document.body
  );

  return (
    <div className={`flex flex-col gap-1 relative ${className}`} ref={containerRef}>
      {label && <label className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">{label}</label>}
      <div className="relative w-full">
        <input ref={inputRef} type="text" className={`line-input w-full pl-0 pr-4 font-semibold transition-all ${isInvalid ? 'border-red-400 text-red-600' : 'text-blue-900'} ${disabled ? 'opacity-50 grayscale' : ''}`} value={displayText} onFocus={() => !disabled && setIsCalendarOpen(true)} onChange={handleTextChange} onBlur={handleBlur} onKeyDown={e => e.key === 'Enter' && handleBlur()} placeholder={placeholder || "dd/mm/yyyy"} disabled={disabled} autoComplete="off" />
        {isInvalid && <span className="text-[9px] text-red-500 font-bold mt-1 uppercase tracking-tighter">Ngày không hợp lệ</span>}
        {calendarPopover}
      </div>
    </div>
  );
};
