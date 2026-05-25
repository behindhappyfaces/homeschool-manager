function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function expandCalItems(items, completions, start, end, person) {
  const results = [];

  for (const item of items) {
    if (person && person !== 'all' && item.assignedTo !== person && item.assignedTo !== 'family') continue;

    if (!item.recurring) {
      if (!item.date) continue;
      if (item.date >= start && item.date <= end) {
        const comp = completions.find(c => c.itemId === item.id && c.date === item.date);
        results.push({ ...item, occurrenceDate: item.date, completed: !!comp, starred: comp?.starred || false, completionId: comp?.id || null });
      }
    } else {
      const rStart = item.recurringStartDate && item.recurringStartDate > start ? item.recurringStartDate : start;
      const rEnd   = item.recurringEndDate   && item.recurringEndDate   < end   ? item.recurringEndDate   : end;
      let cur = rStart;
      while (cur <= rEnd) {
        const dow = new Date(cur + 'T12:00:00').getDay();
        if (item.recurringDays.includes(dow)) {
          const comp = completions.find(c => c.itemId === item.id && c.date === cur);
          results.push({ ...item, occurrenceDate: cur, completed: !!comp, starred: comp?.starred || false, completionId: comp?.id || null });
        }
        cur = addDays(cur, 1);
      }
    }
  }

  return results.sort((a, b) => {
    if (a.occurrenceDate !== b.occurrenceDate) return a.occurrenceDate.localeCompare(b.occurrenceDate);
    return (a.time || '99:99').localeCompare(b.time || '99:99');
  });
}

module.exports = { expandCalItems, addDays };
