import {
  addMinutes,
  eachDayOfInterval,
  endOfDay,
  format,
  getDay,
  isBefore,
  startOfDay,
} from "date-fns";

export type BookedRange = {
  slot_start: string;
  slot_end: string;
};

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Weekdays 9:00–16:00, 15-minute slots; skips Sat/Sun. */
export function generateAvailableSlots(
  rangeStart: Date,
  rangeEnd: Date,
  booked: BookedRange[],
  options?: { startHour?: number; endHour?: number; stepMinutes?: number }
): { dateKey: string; label: string; slots: { start: Date; end: Date; label: string }[] }[] {
  const startHour = options?.startHour ?? 9;
  const endHour = options?.endHour ?? 16;
  const stepMinutes = options?.stepMinutes ?? 15;

  const bookedParsed = booked.map((b) => ({
    start: new Date(b.slot_start),
    end: new Date(b.slot_end),
  }));

  const days = eachDayOfInterval({ start: startOfDay(rangeStart), end: endOfDay(rangeEnd) });
  const out: { dateKey: string; label: string; slots: { start: Date; end: Date; label: string }[] }[] = [];

  for (const day of days) {
    const dow = getDay(day);
    if (dow === 0 || dow === 6) continue;

    const dateKey = format(day, "yyyy-MM-dd");
    const slots: { start: Date; end: Date; label: string }[] = [];

    let cursor = new Date(day);
    cursor.setHours(startHour, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(endHour, 0, 0, 0);

    while (isBefore(cursor, dayEnd)) {
      const slotEnd = addMinutes(cursor, stepMinutes);
      if (slotEnd > dayEnd) break;

      const overlapsBooked = bookedParsed.some((b) =>
        rangesOverlap(cursor, slotEnd, b.start, b.end)
      );
      if (!overlapsBooked) {
        slots.push({
          start: new Date(cursor),
          end: slotEnd,
          label: format(cursor, "h:mm a"),
        });
      }
      cursor = slotEnd;
    }

    out.push({
      dateKey,
      label: format(day, "EEE MMM d"),
      slots,
    });
  }

  return out;
}
