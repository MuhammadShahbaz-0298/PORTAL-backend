// Free text-similarity helpers used for the plagiarism check.
// No external API; Jaccard similarity on shingled tokens.

// Splits text into a set of character n-grams (shingles).
function shingles(text, size = 3) {
  const cleaned = String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const result = new Set();

  if (cleaned.length <= size) {
    if (cleaned.length > 0) {
      result.add(cleaned);
    }
    return result;
  }

  for (let index = 0; index <= cleaned.length - size; index++) {
    result.add(cleaned.slice(index, index + size));
  }

  return result;
}

// Jaccard similarity between two sets.
function jaccardSimilarity(left, right) {
  if (!left || left.size === 0 || !right || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const item of left) {
    if (right.has(item)) {
      intersection++;
    }
  }

  const union = left.size + right.size - intersection;
  if (union === 0) {
    return 0;
  }

  return intersection / union;
}

// Similarity between two texts using shingles of the given size.
function textSimilarity(leftText, rightText, shingleSize = 3) {
  const leftShingles = shingles(leftText, shingleSize);
  const rightShingles = shingles(rightText, shingleSize);
  return jaccardSimilarity(leftShingles, rightShingles);
}

// Extracts plain text from an aiSnapshot.files array.
function extractSnapshotText(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.files)) {
    return "";
  }
  return snapshot.files.map((file) => file.text || "").join("\n");
}

module.exports = {
  shingles,
  jaccardSimilarity,
  textSimilarity,
  extractSnapshotText,
};
