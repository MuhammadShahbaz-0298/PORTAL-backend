// HTTP controller for a ss ig nm en tr es ou rc ec on tr ol le r.
// Keeps request and response handling separate from business rules.
// HTTP layer for assignment resource management.

const multer = require("multer");
const os = require("node:os");
const path = require("node:path");
const asyncHandler = require("../utils/asyncHandler");
const { AppError } = require("../utils/errors");
const assignmentResourceService = require("../services/assignmentResourceService");

const upload = multer({
  dest: path.join(os.tmpdir(), "portal-resource-uploads"),
  limits: { fileSize: assignmentResourceService.MAX_RESOURCE_SIZE_BYTES, files: 1 },
});

const uploadSingleResource = upload.single("resource");

const uploadResource = asyncHandler(async (request, response) => {
  if (!request.file) {
    throw new AppError("No file uploaded.", 400);
  }

  const resource = await assignmentResourceService.uploadResource({
    file: request.file,
    assignmentId: request.params.id,
    requester: request.user,
  });

  return response.status(201).json(resource);
});

const listResources = asyncHandler(async (request, response) => {
  const resources = await assignmentResourceService.listResources({
    assignmentId: request.params.id,
    requester: request.user,
  });

  return response.json(resources);
});

const downloadResource = asyncHandler(async (request, response) => {
  const { filePath, fileName } = await assignmentResourceService.getResourceFile({
    assignmentId: request.params.id,
    resourceId: request.params.resourceId,
    requester: request.user,
  });

  response.set("X-Content-Type-Options", "nosniff");
  return response.download(filePath, fileName);
});

const deleteResource = asyncHandler(async (request, response) => {
  await assignmentResourceService.deleteResource({
    assignmentId: request.params.id,
    resourceId: request.params.resourceId,
    requester: request.user,
  });

  return response.json({ success: true });
});

module.exports = {
  uploadSingleResource,
  uploadResource,
  listResources,
  downloadResource,
  deleteResource,
};
