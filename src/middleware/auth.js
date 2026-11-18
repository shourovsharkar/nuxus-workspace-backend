const jwt = require("jsonwebtoken");
const db = require("../db");

function authenticate(req, res, next) {
 const header = req.headers.authorization || "";
 const token = header.startsWith("Bearer ") ? header.slice(7) : null;
 if (!token) return res.status(401).json({ error: "Authentication required." });
 try {
   const payload = jwt.verify(token, process.env.JWT_SECRET);
   const user = db.prepare("SELECT id,name,email,role,is_verified,created_at FROM users WHERE id=?").get(payload.sub);
   if (!user) return res.status(401).json({ error: "Account no longer exists." });
   req.user = user;
   next();
 } catch {
   return res.status(401).json({ error: "Invalid or expired access token." });
 }
}
function allowRoles(...roles) {
 return (req, res, next) => {
   if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "You do not have permission for this action." });
   next();
 };
}
module.exports = { authenticate, allowRoles };
