// Assignment resource management.
// Resources are teacher-uploaded files attached to an assignment.
// Only the assignment's own teacher or an admin may upload/delete.
// Anyone who can view the assignment's batch may download.

const Assignment = require("../models/Assignment");
const { AppError } = require("../utils/errors");
const { assertObjectId } = require("../utils/validation");
const fs = require("fs");
const path = require("path");
const accessService = require("./assignmentResourceAccessService");
const storageService = require("./assignmentResourceStorage");
const {
  MAX_RESOURCE_SIZE_BYTES,
  ALLOWED_RESOURCE_EXTENSIONS,
  getStorageDir,
  sanitizeOriginalName,
  toPublicResource,
  storeResourceFile,
  resolveResourceFile,
  removeFile,
} = storageService;

async function findActiveAssignment(assignmentId) {
  assertObjectId(assignmentId, "assignment id");
  const assignment = await Assignment.findById(assignmentId);

  if (!assignment || !assignment.active) {
    throw new AppError("Assignment not found.", 404);
  }

  return assignment;
}

function findResource(assignment, resourceId) {
  assertObjectId(resourceId, "resource id");
  const resource = assignment.resources.id(resourceId);

  if (!resource) {
    throw new AppError("Resource not found.", 404);
  }

  return resource;
}

async function uploadResource({ file, assignmentId, requester }) {
  const assignment = await findActiveAssignment(assignmentId);
  await accessService.assertCanManageResources(requester, assignment);

  const extension = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_RESOURCE_EXTENSIONS.includes(extension)) {
    await removeFile(file.path).catch(() => {});
    throw new AppError(`File type ${extension} is not allowed.`, 400);
  }

  if (file.size > MAX_RESOURCE_SIZE_BYTES) {
    await removeFile(file.path).catch(() => {});
    throw new AppError(`File exceeds ${MAX_RESOURCE_SIZE_BYTES / (1024 * 1024)}MB limit.`, 400);
  }

  const { storedName, destination } = await storeResourceFile(file, extension);

  assignment.resources.push({
    fileName: sanitizeOriginalName(file.originalname, extension),
    filePath: storedName,
    uploadedAt: new Date(),
  });

  try {
    await assignment.save();
  } catch (error) {
    await removeFile(destination).catch(() => {});
    throw error;
  }

  return toPublicResource(assignment.resources[assignment.resources.length - 1]);
}

async function listResources({ assignmentId, requester }) {
  const assignment = await findActiveAssignment(assignmentId);
  await accessService.assertCanViewResources(requester, assignment);

  return assignment.resources.map(toPublicResource);
}

async function getResourceFile({ assignmentId, resourceId, requester }) {
  const assignment = await findActiveAssignment(assignmentId);
  const resource = findResource(assignment, resourceId);
  await accessService.assertCanDownload(requester, assignment);

  const filePath = resolveResourceFile(resource.filePath);

  try {
    await fs.promises.access(filePath);
  } catch {
    throw new AppError("Resource not found.", 404);
  }

  return { filePath, fileName: resource.fileName };
}

async function deleteResource({ assignmentId, resourceId, requester }) {
  const assignment = await findActiveAssignment(assignmentId);
  await accessService.assertCanManageResources(requester, assignment);

  const resource = findResource(assignment, resourceId);
  const filePath = resolveResourceFile(resource.filePath);

  await removeFile(filePath);
  assignment.resources.pull(resource._id);
  await assignment.save();

  return { success: true };
}

module.exports = {
  uploadResource,
  listResources,
  getResourceFile,
  deleteResource,
  getStorageDir,
  MAX_RESOURCE_SIZE_BYTES,
  ALLOWED_RESOURCE_EXTENSIONS,
};
