import { format, parseISO, isToday, isYesterday, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export function formatDate(dateString: string, formatStr: string = 'MMM dd, yyyy'): string {
  try {
    const parsed = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(parsed, formatStr);
  } catch {
    return dateString;
  }
}

export function formatRelativeDate(dateString: string): string {
  try {
    const parsed = parseISO(dateString);
    if (isToday(parsed)) return 'Today';
    if (isYesterday(parsed)) return 'Yesterday';
    return format(parsed, 'MMM dd, yyyy');
  } catch {
    return dateString;
  }
}

export function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function getCurrentTimeString(): string {
  return format(new Date(), 'HH:mm:ss');
}

export function getDateRangePresets() {
  const now = new Date();
  return {
    today: {
      from: format(now, 'yyyy-MM-dd'),
      to: format(now, 'yyyy-MM-dd'),
      label: 'Today',
    },
    last7Days: {
      from: format(subDays(now, 7), 'yyyy-MM-dd'),
      to: format(now, 'yyyy-MM-dd'),
      label: 'Last 7 Days',
    },
    last30Days: {
      from: format(subDays(now, 30), 'yyyy-MM-dd'),
      to: format(now, 'yyyy-MM-dd'),
      label: 'Last 30 Days',
    },
    thisMonth: {
      from: format(startOfMonth(now), 'yyyy-MM-dd'),
      to: format(endOfMonth(now), 'yyyy-MM-dd'),
      label: 'This Month',
    },
    thisYear: {
      from: format(startOfYear(now), 'yyyy-MM-dd'),
      to: format(endOfYear(now), 'yyyy-MM-dd'),
      label: 'This Year',
    },
  };
}
