import { createEquipmentService } from "./equipmentService.js";
import { createRequestService } from "./requestService.js";
import { createWeatherService } from "./weatherService.js";

export function createServices({ repositories, weatherClient, config, logger }) {
  const weatherService = createWeatherService({ weatherClient, config: config.weather, logger });

  return {
    weatherService,
    equipmentService: createEquipmentService({ ...repositories, weatherService }),
    requestService: createRequestService(repositories),
  };
}
