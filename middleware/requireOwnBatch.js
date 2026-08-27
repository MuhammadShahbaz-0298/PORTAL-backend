const Submission = require('../models/Submission');
const Batch = require('../models/Batch');

// Checks that the logged-in teacher owns the batch tied to the submission
// being accessed. Admin always bypasses this check.
const requireOwnBatch = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') return next();

    const submission = await Submission.findById(req.params.id).populate('batch');
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    if (String(submission.batch.teacher) !== String(req.user.userId)) {
      return res.status(403).json({ error: 'Not your batch' });
    }

    req.submission = submission; // pass along so the controller doesn't refetch
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = requireOwnBatch;
