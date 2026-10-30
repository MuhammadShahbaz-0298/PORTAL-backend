// HTTP layer for the permission catalog and per-user extra permissions.

const { PERMISSIONS, ROLE_DEFAULTS } = require("../config/permissions");
const permissionService = require("../services/permissionService");
const asyncHandler = require("../utils/asyncHandler");

const catalog = (request, response) => {
  return response.json({ permissions: PERMISSIONS, roleDefaults: ROLE_DEFAULTS });
};

const updateUserPermissions = asyncHandler(async (request, response) => {
  const user = await permissionService.updateUserPermissions({
    userId: request.params.id,
    permissions: request.body.permissions,
  });
  return response.json(user);
});

module.exports = { catalog, updateUserPermissions };
