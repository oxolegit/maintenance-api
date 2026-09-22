import request from "supertest";
import {
  buildApp,
  equipmentPayload,
  requestPayload,
  technicianPayload,
  withKey,
} from "./helpers/app.js";

describe("/api/technicians", () => {
  let app;

  beforeEach(async () => {
    ({ app } = await buildApp());
  });

  const createTechnician = async (overrides) =>
    (await withKey(request(app).post("/api/technicians")).send(technicianPayload(overrides))).body
      .data;

  test("создание, карточка, список с поиском и обновление", async () => {
    const res = await withKey(request(app).post("/api/technicians")).send(
      technicianPayload({ employeeNumber: "t-101" }),
    );
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/technicians/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({ employeeNumber: "T-101", specialization: "механик" });

    await createTechnician({ fullName: "Осипова Мария Сергеевна", specialization: "электрик" });
    const found = await request(app).get("/api/technicians?q=осипова");
    expect(found.body.data.map((item) => item.fullName)).toEqual(["Осипова Мария Сергеевна"]);
    const bySpecialization = await request(app).get("/api/technicians?specialization=механ");
    expect(bySpecialization.body.meta.total).toBe(1);

    const patched = await withKey(request(app).patch(`/api/technicians/${res.body.data.id}`)).send({
      specialization: "механик-высотник",
    });
    expect(patched.body.data.specialization).toBe("механик-высотник");
    expect((await request(app).get(`/api/technicians/${res.body.data.id}`)).body.data).toEqual(
      patched.body.data,
    );
  });

  test("табельный номер уникален среди действующих, тело проверяется", async () => {
    await createTechnician({ employeeNumber: "T-200" });

    const duplicate = await withKey(request(app).post("/api/technicians")).send(
      technicianPayload({ employeeNumber: "T-200" }),
    );
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.details[0].field).toBe("employeeNumber");

    const invalid = await withKey(request(app).post("/api/technicians")).send({
      fullName: "Кто",
      employeeNumber: "номер с пробелами",
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.details.map((detail) => detail.field)).toEqual(
      expect.arrayContaining(["fullName", "specialization", "employeeNumber"]),
    );
  });

  test("мягкое удаление: специалист исчезает из списков, табельный номер освобождается", async () => {
    const technician = await createTechnician({ employeeNumber: "T-300" });

    expect((await withKey(request(app).delete(`/api/technicians/${technician.id}`))).status).toBe(
      204,
    );
    expect((await request(app).get(`/api/technicians/${technician.id}`)).status).toBe(404);
    expect((await request(app).get("/api/technicians")).body.meta.total).toBe(0);

    const reused = await withKey(request(app).post("/api/technicians")).send(
      technicianPayload({ employeeNumber: "T-300" }),
    );
    expect(reused.status).toBe(201);
  });

  test("специалиста с назначениями на незакрытые заявки удалить нельзя", async () => {
    const technician = await createTechnician();
    const equipment = (await withKey(request(app).post("/api/equipment")).send(equipmentPayload()))
      .body.data;
    const maintenance = (
      await withKey(request(app).post("/api/requests")).send(requestPayload(equipment.id))
    ).body.data;
    await withKey(request(app).post(`/api/requests/${maintenance.id}/assignees`)).send({
      assignees: [{ technicianId: technician.id, role: "lead", hours: 4 }],
    });

    const blocked = await withKey(request(app).delete(`/api/technicians/${technician.id}`));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("TECHNICIAN_ASSIGNED");

    await withKey(request(app).patch(`/api/requests/${maintenance.id}/status`)).send({
      status: "rejected",
    });
    expect((await withKey(request(app).delete(`/api/technicians/${technician.id}`))).status).toBe(
      204,
    );
    // в карточке закрытой заявки уволенный специалист по-прежнему виден
    const card = await request(app).get(`/api/requests/${maintenance.id}`);
    expect(card.body.data.assignees[0].technician.fullName).toBe(technician.fullName);
  });
});
