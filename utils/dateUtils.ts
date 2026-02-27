import { ClassSession, ConflictResult } from '../types';
import { format, isSameDay, isBefore, isAfter, getDay, endOfWeek, eachDayOfInterval, endOfMonth, parse, startOfWeek, startOfMonth } from 'date-fns';

export const getWeekDays = (currentDate: Date) => {
  const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start on Monday
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
};

export const getMonthDays = (currentDate: Date) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Ensure grid starts on Monday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: startDate, end: endDate });
};

export const checkConflict = (newClass: ClassSession, existingClasses: ClassSession[], targetDate: Date): ConflictResult => {
  const newStart = parse(newClass.startTime, 'HH:mm', targetDate);
  const newEnd = parse(newClass.endTime, 'HH:mm', targetDate);

  for (const existing of existingClasses) {
    // Skip self if editing
    if (existing.id === newClass.id) continue;

    // Determine if the existing class occurs on this specific date
    let isRelevant = false;
    
    if (existing.type === 'fixed') {
        // Fixed classes happen if the day of week matches
        if (existing.dayOfWeek === getDay(targetDate)) {
            isRelevant = true;
        }
    } else {
        // Flow classes happen only on their specific date
        if (existing.date && isSameDay(parse(existing.date, 'yyyy-MM-dd', new Date()), targetDate)) {
            isRelevant = true;
        }
    }

    if (!isRelevant) continue;

    const existingStart = parse(existing.startTime, 'HH:mm', targetDate);
    const existingEnd = parse(existing.endTime, 'HH:mm', targetDate);

    // Check for overlap: (StartA < EndB) and (EndA > StartB)
    if (isBefore(newStart, existingEnd) && isAfter(newEnd, existingStart)) {
      return { hasConflict: true, conflictingClass: existing };
    }
  }

  return { hasConflict: false };
};

export const getClassesForDate = (date: Date, allClasses: ClassSession[]) => {
  const dayIndex = getDay(date);
  const dateString = format(date, 'yyyy-MM-dd');

  // Separate Flow and Fixed classes relevant to this day
  const relevantFlow = allClasses.filter(c => c.type === 'flow' && c.date === dateString);
  const relevantFixed = allClasses.filter(c => c.type === 'fixed' && c.dayOfWeek === dayIndex);

  // Logic: If a Fixed class overlaps significantly with a Flow class on the same day, 
  // we assume the Flow class is a specific override (e.g., substituting song or teacher) and hide the Fixed class.
  const filteredFixed = relevantFixed.filter(fixed => {
      const fixedStart = parse(fixed.startTime, 'HH:mm', date);
      const fixedEnd = parse(fixed.endTime, 'HH:mm', date);

      const hasOverride = relevantFlow.some(flow => {
          const flowStart = parse(flow.startTime, 'HH:mm', date);
          const flowEnd = parse(flow.endTime, 'HH:mm', date);
          // Check for exact time match or enclosure
          return (flowStart.getTime() === fixedStart.getTime() && flowEnd.getTime() === fixedEnd.getTime());
      });

      return !hasOverride;
  });

  return [...filteredFixed, ...relevantFlow].sort((a, b) => a.startTime.localeCompare(b.startTime));
};