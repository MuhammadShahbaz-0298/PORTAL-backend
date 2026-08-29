const Assignment = require("../models/Assignment");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");

const userId = (user) => user?.userId || user?.id || user?._id;
const userRole = (user) =>
  String(user?.role || "")
    .trim()
    .toLowerCase();
const canManage = async (user, batchId) => {
  if (userRole(user) === "admin") return true;
  if (userRole(user) !== "teacher") return false;
  return Boolean(await Batch.exists({ _id: batchId, teacher: userId(user) }));
};

exports.listAssignments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.batchId) filter.batch = req.query.batchId;
    const role = userRole(req.user);
    const requesterId = userId(req.user);
    if (!requesterId)
      return res.status(401).json({ error: "Session user is missing" });
    if (role === "student") {
      filter.active = true;
      const enrollments = await Enrollment.find({
        student: requesterId,
      }).select("batch");
      filter.batch = { $in: enrollments.map((item) => item.batch) };
    } else if (role === "teacher") {
      const batches = await Batch.find({ teacher: requesterId }).select("_id");
      filter.batch = { $in: batches.map((item) => item._id) };
    } else if (role !== "admin") {
      filter.batch = { $in: [] };
    }
    const assignments = await Assignment.find(filter)
      .populate("batch", "name")
      .populate("createdBy", "name email")
      .sort({ dueDate: 1 });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createAssignment = async (req, res) => {
  try {
    const {
      batch,
      title,
      description,
      dueDate,
      allowedFileTypes,
      maxFileSizeMb,
      resubmissionPolicy,
    } = req.body;
    if (!batch || !title || !dueDate)
      return res
        .status(400)
        .json({ error: "batch, title, and dueDate are required" });
    if (!(await canManage(req.user, batch)))
      return res.status(403).json({ error: "You cannot manage this batch" });
    const assignment = await Assignment.create({
      batch,
      title,
      description,
      dueDate,
      allowedFileTypes,
      maxFileSizeMb,
      resubmissionPolicy,
      createdBy: req.user.userId,
    });
    res.status(201).json(await assignment.populate("batch", "name"));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment)
      return res.status(404).json({ error: "Assignment not found" });
    if (!(await canManage(req.user, assignment.batch)))
      return res
        .status(403)
        .json({ error: "You cannot manage this assignment" });
    const editable = [
      "title",
      "description",
      "dueDate",
      "allowedFileTypes",
      "maxFileSizeMb",
      "resubmissionPolicy",
      "active",
    ];
    editable.forEach((field) => {
      if (req.body[field] !== undefined) assignment[field] = req.body[field];
    });
    if (req.body.active === false && !assignment.closedAt)
      assignment.closedAt = new Date();
    if (req.body.active === true) assignment.closedAt = null;
    await assignment.save();
    res.json(assignment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment)
      return res.status(404).json({ error: "Assignment not found" });
    if (!(await canManage(req.user, assignment.batch)))
      return res
        .status(403)
        .json({ error: "You cannot delete this assignment" });
    assignment.active = false;
    assignment.closedAt = new Date();
    await assignment.save();
    res.json({ message: "Assignment archived" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAssignment = async (req, res) => {
  const assignment = await Assignment.findById(req.params.id).populate(
    "batch",
    "name teacher",
  );
  if (!assignment)
    return res.status(404).json({ error: "Assignment not found" });
  const role = userRole(req.user);
  const requesterId = userId(req.user);
  if (!requesterId)
    return res.status(401).json({ error: "Session user is missing" });
  if (role === "student" && !assignment.active)
    return res.status(410).json({ error: "This assignment is closed" });
  if (
    role === "student" &&
    !(await Enrollment.exists({
      student: requesterId,
      batch: assignment.batch._id,
    }))
  )
    return res.status(403).json({ error: "Not enrolled in this batch" });
  if (
    role === "teacher" &&
    !(await Batch.exists({ _id: assignment.batch._id, teacher: requesterId }))
  )
    return res.status(403).json({ error: "You cannot view this assignment" });
  if (!["admin", "teacher", "student"].includes(role))
    return res.status(403).json({ error: "You cannot view this assignment" });
  res.json(assignment);
};
