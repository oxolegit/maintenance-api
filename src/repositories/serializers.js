// Преобразование объектов API в атрибуты моделей и обратно: координаты хранятся двумя
// колонками, даты отдаются строками ISO, вложенные объекты появляются только там,
// где они были загружены через include

const iso = (value) => (value instanceof Date ? value.toISOString() : value);
const day = (value) => (value === undefined ? undefined : String(value).slice(0, 10));

function withLocation({ location, ...data }) {
  const row = { ...data };
  if (location) {
    row.latitude = location.lat;
    row.longitude = location.lon;
  }
  return row;
}

export function siteToRow(data) {
  return withLocation(data);
}

export function siteToItem(row) {
  const plain = row.get({ plain: true });
  return {
    id: plain.id,
    name: plain.name,
    code: plain.code,
    region: plain.region,
    location: { lat: plain.latitude, lon: plain.longitude },
    createdAt: iso(plain.createdAt),
    updatedAt: iso(plain.updatedAt),
  };
}

export function passportToRow({ lastInspectionAt, ...data }) {
  const row = { ...data };
  if (lastInspectionAt !== undefined) {
    row.lastInspectionAt = lastInspectionAt === null ? null : day(lastInspectionAt);
  }
  return row;
}

export function passportToItem(row) {
  const plain = typeof row.get === "function" ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    equipmentId: plain.equipmentId,
    manufacturer: plain.manufacturer,
    model: plain.model,
    ratedPowerKw: plain.ratedPowerKw,
    lastInspectionAt: plain.lastInspectionAt,
    createdAt: iso(plain.createdAt),
    updatedAt: iso(plain.updatedAt),
  };
}

export function equipmentToRow({ installedAt, ...data }) {
  const row = withLocation(data);
  if (installedAt !== undefined) {
    row.installedAt = day(installedAt);
  }
  return row;
}

export function equipmentToItem(row) {
  const plain = row.get({ plain: true });
  const item = {
    id: plain.id,
    siteId: plain.siteId,
    name: plain.name,
    type: plain.type,
    serialNumber: plain.serialNumber,
    location: { lat: plain.latitude, lon: plain.longitude },
    status: plain.status,
    installedAt: plain.installedAt,
    createdAt: iso(plain.createdAt),
    updatedAt: iso(plain.updatedAt),
  };
  if ("site" in plain) {
    item.site = plain.site && { id: plain.site.id, name: plain.site.name, code: plain.site.code };
  }
  if ("passport" in plain) {
    item.passport = plain.passport && passportToItem(plain.passport);
  }
  return item;
}

export function technicianToItem(row) {
  const plain = typeof row.get === "function" ? row.get({ plain: true }) : row;
  const item = {
    id: plain.id,
    fullName: plain.fullName,
    specialization: plain.specialization,
    employeeNumber: plain.employeeNumber,
  };
  if ("createdAt" in plain) {
    item.createdAt = iso(plain.createdAt);
    item.updatedAt = iso(plain.updatedAt);
  }
  return item;
}

export function assigneeToItem(row) {
  const plain = typeof row.get === "function" ? row.get({ plain: true }) : row;
  return {
    technicianId: plain.technicianId,
    role: plain.role,
    hours: plain.hours,
    technician: plain.technician ? technicianToItem(plain.technician) : undefined,
    assignedAt: iso(plain.createdAt),
  };
}

export function historyToItem(row) {
  const plain = row.get({ plain: true });
  return {
    id: plain.id,
    requestId: plain.requestId,
    previousStatus: plain.previousStatus,
    newStatus: plain.newStatus,
    author: plain.author,
    comment: plain.comment,
    changedAt: iso(plain.changedAt),
  };
}

export function partToItem(row) {
  const plain = typeof row.get === "function" ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    name: plain.name,
    sku: plain.sku,
    unit: plain.unit,
    stockQty: plain.stockQty,
    createdAt: iso(plain.createdAt),
    updatedAt: iso(plain.updatedAt),
  };
}

export function requestPartToItem(row) {
  const plain = row.get({ plain: true });
  return {
    partId: plain.partId,
    quantity: plain.quantity,
    part: plain.part ? partToItem(plain.part) : undefined,
    createdAt: iso(plain.createdAt),
    updatedAt: iso(plain.updatedAt),
  };
}

export function requestToItem(row) {
  const plain = row.get({ plain: true });
  const item = {
    id: plain.id,
    equipmentId: plain.equipmentId,
    title: plain.title,
    description: plain.description,
    priority: plain.priority,
    status: plain.status,
    plannedAt: iso(plain.plannedAt),
    author: plain.author,
    createdAt: iso(plain.createdAt),
    updatedAt: iso(plain.updatedAt),
  };
  if ("equipment" in plain) {
    item.equipment = plain.equipment && {
      id: plain.equipment.id,
      name: plain.equipment.name,
      serialNumber: plain.equipment.serialNumber,
    };
  }
  if ("assignees" in plain) {
    item.assignees = plain.assignees.map(assigneeToItem);
  }
  return item;
}
