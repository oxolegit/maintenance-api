// Преобразование объектов API (контракт Кейса 2) в атрибуты моделей и обратно:
// координаты хранятся двумя колонками, даты отдаются строками ISO

const iso = (value) => (value instanceof Date ? value.toISOString() : value);

export function equipmentToRow({ location, installedAt, ...data }) {
  const row = { ...data };
  if (location) {
    row.latitude = location.lat;
    row.longitude = location.lon;
  }
  if (installedAt !== undefined) {
    row.installedAt = String(installedAt).slice(0, 10);
  }
  return row;
}

export function equipmentToItem(row) {
  const plain = row.get({ plain: true });
  return {
    id: plain.id,
    name: plain.name,
    type: plain.type,
    serialNumber: plain.serialNumber,
    location: { lat: plain.latitude, lon: plain.longitude },
    status: plain.status,
    installedAt: plain.installedAt,
    createdAt: iso(plain.createdAt),
    updatedAt: iso(plain.updatedAt),
  };
}

export function requestToItem(row) {
  const plain = row.get({ plain: true });
  return {
    id: plain.id,
    equipmentId: plain.equipmentId,
    title: plain.title,
    description: plain.description,
    priority: plain.priority,
    status: plain.status,
    plannedAt: iso(plain.plannedAt),
    createdAt: iso(plain.createdAt),
    updatedAt: iso(plain.updatedAt),
  };
}
