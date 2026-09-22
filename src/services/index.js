import { createSiteService } from "./siteService.js";
import { createEquipmentService } from "./equipmentService.js";
import { createPassportService } from "./passportService.js";
import { createRequestService } from "./requestService.js";
import { createTechnicianService } from "./technicianService.js";
import { createAssigneeService } from "./assigneeService.js";
import { createWeatherService } from "./weatherService.js";

export function createServices({ repositories, weatherClient, config, logger }) {
  const weatherService = createWeatherService({ weatherClient, config: config.weather, logger });
  const equipmentService = createEquipmentService({ ...repositories, weatherService });

  return {
    weatherService,
    siteService: createSiteService(repositories),
    equipmentService,
    passportService: createPassportService({ ...repositories, equipmentService }),
    requestService: createRequestService(repositories),
    technicianService: createTechnicianService(repositories),
    assigneeService: createAssigneeService(repositories),
  };
}
