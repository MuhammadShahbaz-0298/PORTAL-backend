const fs = require('fs');
const path = require('path');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Enrollment = require('../models/Enrollment');
const Batch = require('../models/Batch');

const resolveStoredFilePath = (filePath) => (
  path.isAbsolute(filePath) ? filePath : path.resolve(__dirname, '..', filePath)
);

exports.createSubmission = async (req, res) => {
  try {
    const { assignmentId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment || !assignment.active) return res.status(404).json({ error: 'Assignment not found' });
    if (new Date(assignment.dueDate) <= new Date()) return res.status(410).json({ error: 'This assignment has expired' });
    if (!(await Enrollment.exists({ student: req.user.userId, batch: assignment.batch }))) return res.status(403).json({ error: 'You are not enrolled in this batch' });
    const extension = req.file.originalname.toLowerCase().split('.').pop();
    if (assignment.allowedFileTypes.length && !assignment.allowedFileTypes.map(String).includes(extension)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: `File type .${extension} is not allowed` });
    }
    if (req.file.size > assignment.maxFileSizeMb * 1024 * 1024) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: `File exceeds the ${assignment.maxFileSizeMb}MB limit` });
    }
    const previous = await Submission.findOne({ assignment: assignment._id, student: req.user.userId }).select('_id');
    if (previous) {
      fs.unlink(req.file.path, () => {});
      return res.status(409).json({ error: 'You already submitted this assignment. Use Edit submission to replace it.', submissionId: previous._id });
    }
    const attempt = 1;
    const submission = await Submission.create({ assignment: assignment._id, student: req.user.userId, batch: assignment.batch, filePath: req.file.path, fileName: req.file.originalname, fileSize: req.file.size, mimeType: req.file.mimetype, attempt });
    res.status(201).json(await submission.populate(['assignment', 'batch', 'student']));
  } catch (err) { if (req.file) fs.unlink(req.file.path, () => {}); res.status(400).json({ error: err.message }); }
};

exports.updateSubmission = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const submission = await Submission.findOne({ _id: req.params.id, student: req.user.userId }).populate('assignment');
    if (!submission) { fs.unlink(req.file.path, () => {}); return res.status(404).json({ error: 'Submission not found' }); }
    const assignment = submission.assignment;
    if (!assignment.active) { fs.unlink(req.file.path, () => {}); return res.status(410).json({ error: 'This assignment is closed' }); }
    if (new Date(assignment.dueDate) <= new Date()) { fs.unlink(req.file.path, () => {}); return res.status(410).json({ error: 'This assignment has expired' }); }
    if (!(await Enrollment.exists({ student: req.user.userId, batch: assignment.batch }))) { fs.unlink(req.file.path, () => {}); return res.status(403).json({ error: 'You are not enrolled in this batch' }); }
    const extension = req.file.originalname.toLowerCase().split('.').pop();
    if (assignment.allowedFileTypes.length && !assignment.allowedFileTypes.map(String).includes(extension)) { fs.unlink(req.file.path, () => {}); return res.status(400).json({ error: `File type .${extension} is not allowed` }); }
    if (req.file.size > assignment.maxFileSizeMb * 1024 * 1024) { fs.unlink(req.file.path, () => {}); return res.status(400).json({ error: `File exceeds the ${assignment.maxFileSizeMb}MB limit` }); }
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
    if (previousPath && previousPath !== submission.filePath) fs.unlink(resolveStoredFilePath(previousPath), () => {});
    res.json(await submission.populate(['assignment', 'batch', 'student']));
  } catch (err) { if (req.file) fs.unlink(req.file.path, () => {}); res.status(400).json({ error: err.message }); }
};

exports.getSubmissions = async (req, res) => {
  try {
    const filter = {};
    if (req.query.assignmentId) filter.assignment = req.query.assignmentId;
    if (req.user.role === 'student') filter.student = req.user.userId;
    else if (req.user.role === 'teacher') {
      const batches = await Batch.find({ teacher: req.user.userId }).select('_id');
      filter.batch = { $in: batches.map((b) => b._id) };
    } else if (req.user.role !== 'admin') {
      filter._id = { $in: [] };
    }
    const submissions = await Submission.find(filter).populate('assignment', 'title dueDate').populate('student', 'name email').populate('batch', 'name').sort({ submittedAt: -1 });
    res.json(submissions);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.gradeSubmission = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id).populate('batch');
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (req.user.role === 'teacher' && String(submission.batch.teacher) !== String(req.user.userId)) return res.status(403).json({ error: 'You cannot grade this submission' });
    submission.grade = req.body.grade;
    submission.feedback = req.body.feedback || null;
    submission.status = req.body.status === 'rejected' ? 'rejected' : 'graded';
    submission.gradedBy = req.user.userId;
    submission.gradedAt = new Date();
    await submission.save();
    res.json(submission);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.downloadSubmission = async (req, res) => {
  const submission = await Submission.findById(req.params.id).populate('batch');
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  const allowed = req.user.role === 'admin' || (req.user.role === 'student' && String(submission.student) === String(req.user.userId)) || (req.user.role === 'teacher' && String(submission.batch.teacher) === String(req.user.userId));
  if (!allowed) return res.status(403).json({ error: 'Not authorized to access this file' });
  res.download(resolveStoredFilePath(submission.filePath), submission.fileName);
};
