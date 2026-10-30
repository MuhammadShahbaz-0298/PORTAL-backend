// Generates a random one-time password for an admin password reset.
// Every password contains uppercase, lowercase, a digit and a special character.

const crypto = require("crypto");
const { TEMP_PASSWORD_LENGTH } = require("../constants");

// I, O, l and 0 are easy to confuse when a password is read aloud or typed.
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%^&*()-_=+";
const ALL_CHARACTERS = `${UPPERCASE}${LOWERCASE}${DIGITS}${SPECIAL}`;

// WHY: rejection sampling avoids the slight bias of a plain modulo on one byte.
function randomIndex(maximum) {
  const limit = 256 - (256 % maximum);
  let value = crypto.randomBytes(1)[0];

  while (value >= limit) {
    value = crypto.randomBytes(1)[0];
  }

  return value % maximum;
}

function pickCharacter(characters) {
  return characters[randomIndex(characters.length)];
}

function shuffle(characters) {
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters;
}

function generateTemporaryPassword() {
  // Start with one character from each required group, then fill to the limit.
  const characters = [
    pickCharacter(UPPERCASE),
    pickCharacter(LOWERCASE),
    pickCharacter(DIGITS),
    pickCharacter(SPECIAL),
  ];

  while (characters.length < TEMP_PASSWORD_LENGTH) {
    characters.push(pickCharacter(ALL_CHARACTERS));
  }

  return shuffle(characters).join("");
}

module.exports = { generateTemporaryPassword };
