import request from "supertest";
import {
  buildApp,
  equipmentPayload,
  requestPayload,
  technicianPayload,
  withKey,
} from "./helpers/app.js";
import { captureQueries } from "./helpers/db.js";

const MISSING_ID = "0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11";

describe("/api/requests/:id/assignees", () => {
  let app;
  let maintenance;
  let lead;
  let member;

  const create = async (path, payload) =>
    (await withKey(request(app).post(path)).send(payload)).body.data;
  const assign = (assignees, id = maintenance.id) =>
    withKey(request(app).post(`/api/requests/${id}/assignees`)).send({ assignees });
  const brigade = (...people) =>
    people.map(([technician, role, hours = 4]) => ({ technicianId: technician.id, role, hours }));

  beforeEach(async () => {
    ({ app } = await buildApp());
    const equipment = await create("/api/equipment", equipmentPayload());
    maintenance = await create("/api/requests", requestPayload(equipment.id));
    lead = await create("/api/technicians", technicianPayload({ specialization: "инженер" }));
    member = await create("/api/technicians", technicianPayload());
  });

  test("назначает бригаду с ролями и часами, карточка заявки отдаёт состав", async () => {
    const res = await assign(brigade([lead, "lead", 8.5], [member, "member"]));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        technicianId: lead.id,
        role: "lead",
        hours: 8.5,
        technician: {
          id: lead.id,
          fullName: lead.fullName,
          specialization: "инженер",
          employeeNumber: lead.employeeNumber,
        },
        assignedAt: expect.any(String),
      },
      expect.objectContaining({ technicianId: member.id, role: "member", hours: 4 }),
    ]);

    const card = await request(app).get(`/api/requests/${maintenance.id}`);
    expect(card.body.data.assignees).toEqual(res.body.data);
    expect(card.body.data.equipment).toEqual({
      id: maintenance.equipmentId,
      name: "Ветротурбина ВТ-01",
      serialNumber: expect.any(String),
    });
    expect((await request(app).get(`/api/requests/${maintenance.id}/assignees`)).body.data).toEqual(
      res.body.data,
    );
  });

  test("повторное назначение заменяет состав целиком", async () => {
    await assign(brigade([lead, "lead"], [member, "member"]));

    const res = await assign(brigade([member, "lead", 2]));

    expect(res.body.data.map((item) => [item.technicianId, item.role])).toEqual([
      [member.id, "lead"],
    ]);
  });

  test("без ведущего или с двумя ведущими — 422, прежняя бригада остаётся (откат)", async () => {
    await assign(brigade([lead, "lead"]));

    const noLead = await assign(brigade([member, "member"]));
    expect(noLead.status).toBe(422);
    expect(noLead.body.error.details[0]).toMatchObject({ field: "assignees" });

    const twoLeads = await assign(brigade([lead, "lead"], [member, "lead"]));
    expect(twoLeads.status).toBe(409);

    const current = await request(app).get(`/api/requests/${maintenance.id}/assignees`);
    expect(current.body.data.map((item) => item.technicianId)).toEqual([lead.id]);
  });

  test("несуществующий специалист — 404, дубль в составе — 409, всё откатывается", async () => {
    await assign(brigade([lead, "lead"]));

    const missing = await assign([
      { technicianId: member.id, role: "lead", hours: 1 },
      { technicianId: MISSING_ID, role: "member", hours: 1 },
    ]);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("RELATED_NOT_FOUND");

    const duplicate = await assign(brigade([member, "lead"], [member, "member"]));
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("UNIQUE_VIOLATION");

    await withKey(request(app).delete(`/api/technicians/${member.id}`));
    const fired = await assign(brigade([member, "lead"]));
    expect(fired.status).toBe(404);
    expect(fired.body.error.code).toBe("TECHNICIAN_NOT_FOUND");

    const current = await request(app).get(`/api/requests/${maintenance.id}/assignees`);
    expect(current.body.data.map((item) => item.technicianId)).toEqual([lead.id]);
  });

  test("проверка тела: пустой состав, роль, часы", async () => {
    const res = await assign([{ technicianId: "abc", role: "boss", hours: 0 }]);

    expect(res.status).toBe(422);
    expect(res.body.error.details.map((detail) => detail.field)).toEqual(
      expect.arrayContaining(["assignees.0.technicianId", "assignees.0.role", "assignees.0.hours"]),
    );
    expect((await assign([])).status).toBe(422);
  });

  test("закрытая заявка не принимает назначения, несуществующая — 404", async () => {
    await withKey(request(app).patch(`/api/requests/${maintenance.id}/status`)).send({
      status: "rejected",
    });

    const closed = await assign(brigade([lead, "lead"]));
    expect(closed.status).toBe(409);
    expect(closed.body.error.code).toBe("REQUEST_CLOSED");
    expect((await assign(brigade([lead, "lead"]), MISSING_ID)).status).toBe(404);
  });

  test("снятие специалиста: 204, повторно — 404, у заявки в работе последний не снимается", async () => {
    await assign(brigade([lead, "lead"], [member, "member"]));
    const url = (technician) => `/api/requests/${maintenance.id}/assignees/${technician.id}`;

    expect((await withKey(request(app).delete(url(member)))).status).toBe(204);
    expect((await withKey(request(app).delete(url(member)))).status).toBe(404);

    await withKey(request(app).patch(`/api/requests/${maintenance.id}/status`)).send({
      status: "in_progress",
    });
    const last = await withKey(request(app).delete(url(lead)));
    expect(last.status).toBe(409);
    expect(last.body.error.code).toBe("REQUEST_HAS_NO_ASSIGNEES");
  });

  test("карточка заявки с бригадой читается одним запросом", async () => {
    await assign(brigade([lead, "lead"], [member, "member"]));

    const queries = await captureQueries(() => request(app).get(`/api/requests/${maintenance.id}`));

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/LEFT OUTER JOIN "request_assignees"/);
  });
});
