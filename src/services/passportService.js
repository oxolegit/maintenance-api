import { NotFoundError } from "../errors/index.js";

export function createPassportService({ passportRepository, equipmentService }) {
  const notFound = (equipmentId) =>
    new NotFoundError(`У оборудования ${equipmentId} нет паспорта`, {
      code: "PASSPORT_NOT_FOUND",
    });

  return {
    async getByEquipment(equipmentId) {
      await equipmentService.getById(equipmentId);
      const passport = await passportRepository.findByEquipment(equipmentId);
      if (!passport) {
        throw notFound(equipmentId);
      }
      return passport;
    },

    // PUT: паспорт создаётся или полностью заменяется — ресурс один на единицу оборудования
    async put(equipmentId, data) {
      await equipmentService.getById(equipmentId);
      return passportRepository.upsertForEquipment(equipmentId, data);
    },

    async remove(equipmentId) {
      await equipmentService.getById(equipmentId);
      if (!(await passportRepository.removeByEquipment(equipmentId))) {
        throw notFound(equipmentId);
      }
    },
  };
}
