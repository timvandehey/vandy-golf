export function getDateParts(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return {
    yyyy: d.getFullYear(),
    MM: String(d.getMonth() + 1).padStart(2, '0'),
    dd: String(d.getDate()).padStart(2, '0'),
    hh: String(d.getHours()).padStart(2, '0'),
    mm: String(d.getMinutes()).padStart(2, '0'),
    ss: String(d.getSeconds()).padStart(2, '0')
  };
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('T')[0].split('-');
  if (!y || !m || !d) return dateString;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
