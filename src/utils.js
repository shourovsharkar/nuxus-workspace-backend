const crypto = require("node:crypto");
function makeCode() { return String(crypto.randomInt(0, 10000)).padStart(4, "0"); }
function makePublicCode(prefix) { return `${prefix}-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`; }
module.exports = { makeCode, makePublicCode };
