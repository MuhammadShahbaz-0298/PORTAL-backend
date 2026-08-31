const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const Attendance = require("../models/Attendance");

// POST /api/batches  (admin only)
exports.createBatch = async (req, res) => {
  try {
    const { name, teacherId } = req.body;
    const batch = await Batch.create({ name, teacher: teacherId });
    res.status(201).json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/batches/:id/enroll  (admin only)
exports.enrollStudent = async (req, res) => {
  try {
    const { studentId } = req.body;
    const targetBatch = await Batch.findById(req.params.id);
    if (!targetBatch) return res.status(404).json({ error: "Batch not found" });
    await Enrollment.deleteMany({
      student: studentId,
      batch: { $ne: req.params.id },
    });
    const enrollment = await Enrollment.findOneAndUpdate(
      { student: studentId, batch: req.params.id },
      { student: studentId, batch: req.params.id },
      { upsert: true, new: true },
    );
    res.status(201).json(enrollment);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ error: "Student already enrolled in this batch" });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.updateBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    const { name, teacherId } = req.body;
    if (name !== undefined) {
      if (!String(name).trim())
        return res.status(400).json({ error: "Batch name is required." });
      batch.name = String(name).trim();
    }
    if (teacherId !== undefined) batch.teacher = teacherId;

    await batch.save();
    res.json(await batch.populate("teacher", "name email"));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) return res.status(404).json({ error: "Batch not found" });

    await Attendance.updateMany(
      { batch: batch._id },
      { $set: { batchName: batch.name } },
    );
    await Enrollment.deleteMany({ batch: batch._id });
    await batch.deleteOne();
    res.json({ message: "Batch deleted successfully." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// GET /api/batches  (scoped by role)
exports.getBatchStudents = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ batch: req.params.id })
      .populate("student", "name email role active")
      .sort({ createdAt: 1 });
    res.json(
      enrollments.map((enrollment) => enrollment.student).filter(Boolean),
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBatches = async (req, res) => {
  try {
    let batches;

    if (req.user.role === "admin") {
      batches = await Batch.find().populate("teacher", "name email");
    } else if (req.user.role === "teacher") {
      batches = await Batch.find({ teacher: req.user.userId }).populate(
        "teacher",
        "name email",
      );
    } else if (req.user.role === "student") {
      const enrollments = await Enrollment.find({
        student: req.user.userId,
      }).populate({
        path: "batch",
        populate: { path: "teacher", select: "name email" },
      });
      batches = enrollments.map((e) => e.batch);
    } else {
      batches = [];
    }

    const batchesWithCounts = await Promise.all(
      (batches || []).filter(Boolean).map(async (batch) => {
        const value = batch.toObject ? batch.toObject() : batch;
        value.studentCount = await Enrollment.countDocuments({
          batch: value._id,
        });
        return value;
      }),
    );
    res.json(batchesWithCounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
