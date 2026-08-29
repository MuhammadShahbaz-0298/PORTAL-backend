const Attendance = require("../models/Attendance");
const Enrollment = require("../models/Enrollment");
const Batch = require("../models/Batch");
const userId = (user) => user?.userId || user?.id || user?._id;
const userRole = (user) =>
  String(user?.role || "")
    .trim()
    .toLowerCase();
const canManageBatch = async (user, batchId) =>
  userRole(user) === "admin" ||
  (userRole(user) === "teacher" &&
    (await Batch.exists({ _id: batchId, teacher: userId(user) })));

exports.addAttendance = async (req, res) => {
  try {
    const { studentId, batchId, date, status } = req.body;
    if (!studentId || !batchId || !date || !status)
      return res
        .status(400)
        .json({ error: "studentId, batchId, date, and status are required" });
    if (!(await canManageBatch(req.user, batchId)))
      return res
        .status(403)
        .json({ error: "You cannot manage attendance for this batch" });
    if (!userId(req.user))
      return res.status(401).json({ error: "Session user is missing" });
    if (!(await Enrollment.exists({ student: studentId, batch: batchId })))
      return res
        .status(400)
        .json({ error: "Student is not enrolled in this batch" });
    const record = await Attendance.findOneAndUpdate(
      { student: studentId, batch: batchId, date: new Date(date) },
      {
        $set: { status, enteredBy: userId(req.user) },
        $setOnInsert: {
          student: studentId,
          batch: batchId,
          date: new Date(date),
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
    res.status(200).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.listAttendance = async (req, res) => {
  try {
    const filter = {};
    if (req.query.batchId) filter.batch = req.query.batchId;
    if (req.query.studentId) filter.student = req.query.studentId;
    if (req.query.date) {
      const start = new Date(req.query.date);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: start, $lt: end };
    }
    const role = userRole(req.user);
    const requesterId = userId(req.user);
    if (!requesterId)
      return res.status(401).json({ error: "Session user is missing" });
    if (role === "student") filter.student = requesterId;
    if (role === "teacher") {
      const batches = await Batch.find({ teacher: requesterId }).select("_id");
      filter.batch = { $in: batches.map((batch) => batch._id) };
    } else if (role !== "admin" && role !== "student") filter._id = { $in: [] };
    const records = await Attendance.find(filter)
      .populate("student", "name email")
      .populate("batch", "name")
      .sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateAttendance = async (req, res) => {
  try {
    const existing = await Attendance.findById(req.params.id);
    if (!existing)
      return res.status(404).json({ error: "Attendance record not found" });
    if (!(await canManageBatch(req.user, existing.batch)))
      return res
        .status(403)
        .json({ error: "You cannot edit attendance for this batch" });
    const record = await Attendance.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status, date: req.body.date },
      { new: true, runValidators: true },
    );
    if (!record)
      return res.status(404).json({ error: "Attendance record not found" });
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAttendanceSummary = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const role = userRole(req.user);
    const requesterId = userId(req.user);
    if (!requesterId)
      return res.status(401).json({ error: "Session user is missing" });
    if (role === "student" && String(requesterId) !== studentId)
      return res
        .status(403)
        .json({ error: "Cannot view another student attendance" });
    if (
      role === "teacher" &&
      !(await Enrollment.exists({
        student: studentId,
        batch: {
          $in: (await Batch.find({ teacher: requesterId }).select("_id")).map(
            (batch) => batch._id,
          ),
        },
      }))
    )
      return res
        .status(403)
        .json({ error: "You cannot view attendance for this student" });
    if (!["admin", "teacher", "student"].includes(role))
      return res.status(403).json({ error: "You cannot view this attendance" });
    const records = await Attendance.find({ student: studentId })
      .populate("student", "name email")
      .populate("batch", "name")
      .sort({ date: -1 });
    const present = records.filter((r) => r.status === "present").length;
    res.json({
      studentId,
      present,
      total: records.length,
      percentage: records.length
        ? Math.round((present / records.length) * 100)
        : 0,
      records,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
