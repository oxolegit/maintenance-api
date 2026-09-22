import { DataTypes } from "sequelize";
import { ASSIGNEE_ROLES } from "../../models/assignee.js";
import { decimal } from "./common.js";

export function defineRequestAssignee(sequelize) {
  return sequelize.define(
    "RequestAssignee",
    {
      requestId: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      technicianId: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      role: { type: DataTypes.ENUM(...ASSIGNEE_ROLES), allowNull: false, defaultValue: "member" },
      hours: decimal("hours", 6, 2, { allowNull: false }),
    },
    { tableName: "request_assignees", updatedAt: false },
  );
}
