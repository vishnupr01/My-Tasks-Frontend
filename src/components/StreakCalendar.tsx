'use client';

const WEEKS = 16;
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function cellColor(count: number, isFuture: boolean, isToday: boolean): string {
  if (isFuture) return 'bg-transparent border-green-950/20';
  if (isToday)  return 'bg-[rgb(var(--heat-today-bg))] border-2 border-[rgb(var(--heat-today-bd))] shadow-[0_0_5px_rgba(var(--glow-rgb),calc(0.6*var(--glow-mult)))]';
  if (count === 0) return 'bg-[rgb(var(--heat-0-bg))] border-[rgb(var(--heat-0-bd))]';
  if (count === 1) return 'bg-[rgb(var(--heat-1-bg))] border-[rgb(var(--heat-1-bd))]';
  if (count <= 3)  return 'bg-[rgb(var(--heat-2-bg))] border-[rgb(var(--heat-2-bd))]';
  if (count <= 6)  return 'bg-[rgb(var(--heat-3-bg))] border-[rgb(var(--heat-3-bd))]';
  return                  'bg-[rgb(var(--heat-4-bg))] border-[rgb(var(--heat-4-bd))]';
}

interface Props {
  calendar: Record<string, number>;
}

export default function StreakCalendar({ calendar }: Props) {
  const toDateStr = (d: Date) => {
    // Use local date to avoid UTC-shift artifacts
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayStr = toDateStr(today);

  // Snap grid end to the Saturday of the current week
  const daysToSaturday = (6 - today.getDay() + 7) % 7;
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + daysToSaturday);

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - WEEKS * 7 + 1);

  // Build weeks
  type Cell = { dateStr: string; count: number; isToday: boolean; isFuture: boolean; date: Date };
  const weeks: Cell[][] = [];
  const cur = new Date(startDate);

  for (let w = 0; w < WEEKS; w++) {
    const week: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(cur);
      const dateStr = toDateStr(date);
      week.push({
        date,
        dateStr,
        count: calendar[dateStr] ?? 0,
        isToday: dateStr === todayStr,
        isFuture: date > today,
      });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  // Month labels: show the month name in the first week it appears
  const monthLabels: Record<number, string> = {};
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const m = week[0].date.getMonth();
    if (m !== lastMonth) {
      monthLabels[wi] = week[0].date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      lastMonth = m;
    }
  });

  return (
    <div className="flex gap-1 overflow-x-auto">
      {/* Day-of-week labels */}
      <div className="flex flex-col gap-[3px] shrink-0">
        <div className="h-4" /> {/* month row spacer */}
        {DAY_LABELS.map((label, i) => (
          <div key={i} className="w-3 h-3 text-[9px] text-green-900 flex items-center justify-center">
            {i % 2 === 1 ? label : ''}
          </div>
        ))}
      </div>

      {/* Week columns */}
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px] shrink-0">
          {/* Month label */}
          <div className="h-4 flex items-end">
            <span className="text-[9px] text-green-800 leading-none">
              {monthLabels[wi] ?? ''}
            </span>
          </div>
          {/* Day squares */}
          {week.map((cell, di) => (
            <div
              key={di}
              title={`${cell.dateStr}  ${cell.isFuture ? '—' : cell.count === 0 ? 'no tasks' : `${cell.count} task${cell.count > 1 ? 's' : ''} done`}`}
              className={`w-3 h-3 border rounded-[2px] cursor-default transition-all hover:scale-125 ${cellColor(cell.count, cell.isFuture, cell.isToday)}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
