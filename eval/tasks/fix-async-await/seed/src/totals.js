export async function loadTotals(fetchOne, ids) {
  let total = 0;
  for (const id of ids) {
    total += fetchOne(id);
  }
  return total;
}
