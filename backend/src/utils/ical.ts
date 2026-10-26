import crypto from 'crypto';

export interface IcalEvent {
  uid: string;
  start: Date;
  end: Date;
  summary?: string;
}

// RFC 5545 line unfolding: CRLF + space/tab continues the previous line.
const unfold = (ical: string): string[] =>
  ical
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .split(/\r?\n/);

// Parses YYYYMMDD (all-day) and YYYYMMDDTHHMMSS[Z]. Floating times are read
// as UTC — OTA feeds are UTC or date-only in practice.
const parseDate = (value: string): Date | null => {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss] = m;
  if (hh === undefined) return new Date(Date.UTC(+y, +mo - 1, +d));
  return new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss));
};

const unescapeText = (s: string) =>
  s.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();

export const parseIcs = (ical: string): IcalEvent[] => {
  const events: IcalEvent[] = [];
  let current: { uid?: string; start?: Date; end?: Date; summary?: string } | null = null;

  for (const rawLine of unfold(ical)) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.start && current.end) {
        const uid =
          current.uid ||
          crypto
            .createHash('sha1')
            .update(`${current.summary || ''}|${current.start.toISOString()}|${current.end.toISOString()}`)
            .digest('hex');
        events.push({ uid, start: current.start, end: current.end, summary: current.summary });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const prop = line.slice(0, colon).split(';')[0];
    const value = line.slice(colon + 1);

    if (prop === 'DTSTART') current.start = parseDate(value) ?? current.start;
    else if (prop === 'DTEND') current.end = parseDate(value) ?? current.end;
    else if (prop === 'UID') current.uid = value;
    else if (prop === 'SUMMARY') current.summary = unescapeText(value);
  }

  return events;
};

const formatIcsDate = (d: Date) =>
  d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const escapeText = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r?\n/g, '\\n');

const foldLine = (line: string): string => {
  // RFC 5545: lines SHOULD be <= 75 octets; fold with CRLF + space.
  if (line.length <= 75) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 74) {
    parts.push((i === 0 ? '' : ' ') + line.slice(i, i + 74));
  }
  return parts.join('\r\n');
};

export const generateIcs = (calendarName: string, events: IcalEvent[]): string => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//InnSight//PMS//EN`,
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  const stamp = formatIcsDate(new Date());
  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${formatIcsDate(e.start)}`);
    lines.push(`DTEND:${formatIcsDate(e.end)}`);
    if (e.summary) lines.push(foldLine(`SUMMARY:${escapeText(e.summary)}`));
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
};
