const fs = require('fs');
const path = require('path');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Enrollment = require('../models/Enrollment');
const Batch = require('../models/Batch');
const { AppError } = require('../utils/errors');
const { isZipFile, removeFile } = require('../utils/files');
const { getUserId, isAdmin, isTeacher } = require('../utils/authorization');

const resolveStoredFilePath = (filePath) => (
  path.isAbsolute(filePath) ? filePath : path.resolve(__dirname, '..', filePath)
);

const removeUploadedFile = async (file) => {
  if (file?.path) await removeFile(file.path);
};

const validateUploadedArchive = async (file, assignment) => {
  if (!file) throw new AppError('No file uploaded.', 400);
  if (!(await isZipFile(file.path))) throw new AppError('The uploaded file is not a valid ZIP archive.', 400);

  const extension = path.extname(file.originalname).slice(1).toLowerCase();
  const allowedTypes = (assignment.allowedFileTypes || []).map((value) => String(value).toLowerCase());
  if (allowedTypes.length && !allowedTypes.includes(extension)) {
    throw new AppError(`File type .${extension} is not allowed.`, 400);
  }
  if (file.size > assignment.maxFileSizeMb * 1024 * 1024) {
    throw new AppError(`File exceeds the ${assignment.maxFileSizeMb}MB limit.`, 400);
  }
};

const ensureStudentEnrollment = async (assignment, studentId) => {
  if (!(await Enrollment.exists({ student: studentId, batch: assignment.batch }))) {
    throw new AppError('You are not enrolled in this batch.', 403);
  }
};

exports.createSubmission = async (req, res, next) => {
  try {
    const { assignmentId } = req.body;
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment || !assignment.active) throw new AppError('Assignment not found.', 404);
    if (new Date(assignment.dueDate) <= new Date()) throw new AppError('This assignment has expired.', 410);

    await ensureStudentEnrollment(assignment, req.user.userId);
    await validateUploadedArchive(req.file, assignment);

    const previous = await Submission.exists({ assignment: assignment._id, student: req.user.userId });
    if (previous) throw new AppError('You already submitted this assignment. Use Edit submission to replace it.', 409);

    const submission = await Submission.create({
      assignment: assignment._id,
      student: req.user.userId,
      batch: assignment.batch,
      filePath: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      attempt: 1,
    });
    return res.status(201).json(await submission.populate(['assignment', 'batch', 'student']));
  } catch (error) {
    await removeUploadedFile(req.file);
    return next(error);
  }
};

exports.updateSubmission = async (req, res, next) => {
  try {
    const submission = await Submission.findOne({ _id: req.params.id, student: req.user.userId }).populate('assignment');
    if (!submission) throw new AppError('Submission not found.', 404);

    const assignment = submission.assignment;
    if (!assignment.active) throw new AppError('This assignment is closed.', 410);
    if (assignment.resubmissionPolicy === 'disabled') throw new AppError('Resubmissions are disabled for this assignment.', 403);
    if (new Date(assignment.dueDate) <= new Date()) throw new AppError('This assignment has expired.', 410);

    await ensureStudentEnrollment(assignment, req.user.userId);
    await validateUploadedArchive(req.file, assignment);

    const previousPath = submission.filePath;
    submission.filePath = req.file.path;
    submission.fileName = req.file.originalname;
    submission.fileSize = req.file.size;
    submission.mimeType = req.file.mimetype;
    submission.status = 'submitted';
    submission.grade = null;
    submission.feedback = null;
    submission.gradedBy = null;
    submission.gradedAt = null;
    submission.submittedAt = new Date();
    await submission.save();

    if (previousPath && previousPath !== submission.filePath) await removeFile(resolveStoredFilePath(previousPath));
    return res.json(await submission.populate(['assignment', 'batch', 'student']));
  } catch (error) {
    await removeUploadedFile(req.file);
    return next(error);
  }
};

exports.getSubmissions = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.assignmentId) filter.assignment = req.query.assignmentId;
    if (req.user.role === 'student') filter.student = getUserId(req.user);
    else if (isTeacher(req.user)) {
      const batches = await Batch.find({ teacher: getUserId(req.user) }).select('_id').lean();
      filter.batch = { $in: batches.map((batch) => batch._id) };
    } else if (!isAdmin(req.user)) filter._id = { $in: [] };

    const submissions = await Submission.find(filter)
      .populate('assignment', 'title dueDate')
      .populate('student', 'name email')
      .populate('batch', 'name')
      .sort({ submittedAt: -1 });
    return res.json(submissions);
  } catch (error) {
    return next(error);
  }
};

exports.gradeSubmission = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id).populate('batch');
    if (!submission) throw new AppError('Submission not found.', 404);
    if (isTeacher(req.user) && String(submission.batch.teacher) !== String(getUserId(req.user))) {
      throw new AppError('You cannot grade this submission.', 403);
    }
    if (req.body.grade === undefined || req.body.grade === null || String(req.body.grade).trim() === '') {
      throw new AppError('A grade is required.', 400);
    }

    submission.grade = String(req.body.grade).trim();
    submission.feedback = req.body.feedback ? String(req.body.feedback).trim() : null;
    submission.status = req.body.status === 'rejected' ? 'rejected' : 'graded';
    submission.gradedBy = getUserId(req.user);
    submission.gradedAt = new Date();
    await submission.save();
    return res.json(submission);
  } catch (error) {
    return next(error);
  }
};

exports.downloadSubmission = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id).populate('batch');
    if (!submission) throw new AppError('Submission not found.', 404);

    const allowed = isAdmin(req.user)
      || (req.user.role === 'student' && String(submission.student) === String(getUserId(req.user)))
      || (isTeacher(req.user) && String(submission.batch.teacher) === String(getUserId(req.user)));
    if (!allowed) throw new AppError('Not authorized to access this file.', 403);

    const filePath = resolveStoredFilePath(submission.filePath);
    if (!fs.existsSync(filePath)) throw new AppError('Submission file is no longer available.', 404);
    return res.download(filePath, submission.fileName);
  } catch (error) {
    return next(error);
  }
};
