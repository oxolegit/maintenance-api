import request from "supertest";
import {
  buildApp,
  equipmentPayload,
  requestPayload,
  technicianPayload,
  withKey,
} from "./helpers/app.js";
import { getTestSequelize } from "./helpers/db.js";
import { getModels } from "../src/db/models/index.js";

describe("журнал статусов заявки", () => {
  let app;
  let maintenance;
  let technician;

  const create = async (path, payload) =>
    (await withKey(request(app).post(path)).send(payload)).body.data;
  const setStatus = (id, body) =>
    withKey(request(app).patch(`/api/requests/${id}/status`)).send(body);
  const assignBrigade = (id) =>
    withKey(request(app).post(`/api/requests/${id}/assignees`)).send({
      assignees: [{ technicianId: technician.id, role: "lead", hours: 2 }],
    });
  const history = async (id) => (await request(app).get(`/api/requests/${id}/history`)).body.data;

  beforeEach(async () => {
    ({ app } = await buildApp());
    const equipment = await create("/api/equipment", equipmentPayload());
    technician = await create("/api/technicians", technicianPayload());
    maintenance = await create("/api/requests", requestPayload(equipment.id, { author: "Иванов" }));
  });

  test("создание и каждый переход оставляют запись с автором и комментарием", async () => {
    expect(maintenance.author).toBe("Иванов");
    await assignBrigade(maintenance.id);
    await setStatus(maintenance.id, { status: "in_progress", author: "Петров" });
    const done = await setStatus(maintenance.id, {
      status: "done",
      author: "Бекиров",
      comment: "Подшипник заменён",
    });
    expect(done.status).toBe(200);

    const rows = await history(maintenance.id);

    expect(rows.map((row) => [row.previousStatus, row.newStatus, row.author, row.comment])).toEqual(
      [
        [null, "new", "Иванов", null],
        ["new", "in_progress", "Петров", null],
        ["in_progress", "done", "Бекиров", "Подшипник заменён"],
      ],
    );
    expect(rows[0]).toMatchObject({
      id: expect.any(Number),
      requestId: maintenance.id,
      changedAt: expect.any(String),
    });
    expect(rows[2].changedAt >= rows[0].changedAt).toBe(true);
  });

  test("без бригады заявку нельзя взять в работу, журнал при этом не растёт", async () => {
    const res = await setStatus(maintenance.id, { status: "in_progress" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("REQUEST_HAS_NO_ASSIGNEES");
    expect((await request(app).get(`/api/requests/${maintenance.id}`)).body.data.status).toBe(
      "new",
    );
    expect(await history(maintenance.id)).toHaveLength(1);
  });

  test("недопустимый переход не оставляет следов в журнале", async () => {
    const res = await setStatus(maintenance.id, { status: "done" });

    expect(res.status).toBe(409);
    expect(await history(maintenance.id)).toHaveLength(1);
  });

  test("при сбое записи в журнал статус заявки откатывается", async () => {
    // отдельный экземпляр приложения, у которого запись в журнал намеренно сломана
    const failing = await buildApp();
    failing.repositories.historyRepository.append = async () => {
      throw new Error("журнал недоступен");
    };
    await assignBrigade(maintenance.id);

    const res = await withKey(
      request(failing.app).patch(`/api/requests/${maintenance.id}/status`),
    ).send({ status: "in_progress" });

    expect(res.status).toBe(500);
    expect((await request(app).get(`/api/requests/${maintenance.id}`)).body.data.status).toBe(
      "new",
    );
    expect(await history(maintenance.id)).toHaveLength(1);
  });

  test("два параллельных перехода одной заявки: один проходит, второй получает 409", async () => {
    await assignBrigade(maintenance.id);

    const results = await Promise.all([
      setStatus(maintenance.id, { status: "in_progress" }),
      setStatus(maintenance.id, { status: "in_progress" }),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await history(maintenance.id)).toHaveLength(2);
  });

  test("журнал не редактируется и не удаляется напрямую, но уходит вместе с заявкой", async () => {
    const { RequestStatusHistory } = getModels(getTestSequelize());

    await expect(
      RequestStatusHistory.update({ comment: "x" }, { where: { requestId: maintenance.id } }),
    ).rejects.toThrow(/не редактируется/);
    await expect(
      RequestStatusHistory.destroy({ where: { requestId: maintenance.id } }),
    ).rejects.toThrow(/не редактируется/);

    expect((await withKey(request(app).delete(`/api/requests/${maintenance.id}`))).status).toBe(
      204,
    );
    expect(await RequestStatusHistory.count({ where: { requestId: maintenance.id } })).toBe(0);
    expect((await request(app).get(`/api/requests/${maintenance.id}/history`)).status).toBe(404);
  });
});
