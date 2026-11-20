// HTTP controller for p er mi ss io nc on tr ol le r.
// Keeps request and response handling separate from business rules.
// HTTP layer for the permission catalog and per-user extra permissions.

const { PERMISSIONS, PERMISSION_META, ROLE_DEFAULTS } = require("../config/permissions");
const permissionService = require("../services/permissionService");
const asyncHandler = require("../utils/asyncHandler");

const catalog = (request, response) => {
  return response.json({
    permissions: PERMISSIONS,
    permissionMeta: PERMISSION_META,
    roleDefaults: ROLE_DEFAULTS,
  });
};

const updateUserPermissions = asyncHandler(async (request, response) => {
  const user = await permissionService.updateUserPermissions({
    userId: request.params.id,
    permissions: request.body.permissions,
  });
  return response.json(user);
});

module.exports = { catalog, updateUserPermissions };
