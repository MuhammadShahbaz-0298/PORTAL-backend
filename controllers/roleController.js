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

const deleteRole = asyncHandler(async (request, response) => {
  const result = await roleService.deleteRole({ roleId: request.params.id });
  return response.json(result);
});

module.exports = { listRoles, createRole, updateRole, deleteRole };
