export { componentRegistry } from "./registryCore";
export { registerDeviceComponents } from "./registerDeviceComponents";

import { componentRegistry } from "./registryCore";
import { registerBasicComponents } from "./registerBasicComponents";
import { registerMapComponents } from "./registerMapComponents";
import { registerDecorationComponents } from "./registerDecorationComponents";
import { registerDeviceTemplateComponents } from "./registerDeviceComponents";
import { registerChartComponents } from "./registerChartComponents";
import logger from "../utils/logger";

export function registerBuiltinComponents(): void {
  logger.info("Registry", "registerBuiltinComponents START", {
    beforeCount: componentRegistry.getAll().length,
  });
  registerBasicComponents();
  logger.info("Registry", "registerBasicComponents DONE", {
    afterCount: componentRegistry.getAll().length,
  });
  registerMapComponents();
  logger.info("Registry", "registerMapComponents DONE", {
    afterCount: componentRegistry.getAll().length,
  });
  registerDecorationComponents();
  logger.info("Registry", "registerDecorationComponents DONE", {
    afterCount: componentRegistry.getAll().length,
  });
  registerDeviceTemplateComponents();
  logger.info("Registry", "registerDeviceTemplateComponents DONE", {
    afterCount: componentRegistry.getAll().length,
  });
  registerChartComponents();
  logger.info("Registry", "registerChartComponents DONE", {
    afterCount: componentRegistry.getAll().length,
    techCornerRegistered: !!componentRegistry.get("tech-corner-title-frame"),
    centerDiamondRegistered: !!componentRegistry.get("center-diamond-title-frame"),
    allTitleFrameTypes: componentRegistry.getAll().filter((d) => d.type.includes("title-frame")).map((d) => d.type),
  });
  logger.info("Registry", "registerBuiltinComponents END", {
    finalCount: componentRegistry.getAll().length,
    allTypes: componentRegistry.getAll().map((d) => d.type),
  });
}
