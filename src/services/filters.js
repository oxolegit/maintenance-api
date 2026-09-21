const END_OF_DAY = "T23:59:59.999Z";

export function dateRange(from, to) {
  if (!from && !to) {
    return undefined;
  }
  return { gte: from, lte: to && `${to}${END_OF_DAY}` };
}
