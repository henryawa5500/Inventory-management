export function businessDate(timestamp: number | string, cutoff = '23:00'): string {
  const date = new Date(timestamp)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const day = Number(values.day)
  const month = Number(values.month)
  const year = Number(values.year)
  const hour = Number(values.hour)
  const minute = Number(values.minute)

  const [cutoffHour, cutoffMinute] = cutoff.split(':').map(Number)
  const cutoffMinutes = cutoffHour * 60 + cutoffMinute
  const currentMinutes = hour * 60 + minute

  const businessDate = new Date(Date.UTC(year, month - 1, day))
  if (currentMinutes >= cutoffMinutes) {
    businessDate.setUTCDate(businessDate.getUTCDate() + 1)
  }

  return businessDate.toISOString().slice(0, 10)
}
