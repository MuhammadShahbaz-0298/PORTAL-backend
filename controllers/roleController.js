// HTTP layer for roles.

const roleService = require("../services/roleService");
const asyncHandler = require("../utils/asyncHandler");

const listRoles = asyncHandler(async (request, response) => {
  const result = await roleService.listRoles();
  return response.json(result);
});

const createRole = asyncHandler(async (request, response) => {
  const role = await roleService.createRole({ payload: request.body });
  return response.status(201).json(role);
});

const updateRole = asyncHandler(async (request, response) => {
  const role = await roleService.updateRole({
    roleId: request.params.id,
    payload: request.body,
  });
  return response.json(role);
});

module.exports = { listRoles, createRole, updateRole };
