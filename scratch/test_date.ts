const excelDateToJS = (serial) => {
  if (!serial || isNaN(serial)) return null;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
};

console.log("46074 ->", excelDateToJS(46074)); // Should be 2026-03-22
console.log("46024 ->", excelDateToJS(46024)); // Original Video_date for first row
console.log("2026-03-24 relative to 1900-01-01:", Math.round(new Date('2026-03-23').getTime() / (1000 * 86400)) + 25569);
