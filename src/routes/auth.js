const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const db = require("../db");
const { makeCode } = require("../utils");
const { authenticate } = require("../middleware/auth");
const router = express.Router();

const registerSchema = z.object({
 name: z.string().trim().min(2).max(80),
 email: z.string().trim().email().max(160),
 password: z.string().min(8).max(72)
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

function issueToken(user) {
 return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "8h" });
}
function publicUser(user) {
 return { id:user.id, name:user.name, email:user.email, role:user.role, isVerified:!!user.is_verified };
}
function issueOtp(email, purpose) {
 const code = makeCode();
 const hash = bcrypt.hashSync(code, 10);
 db.prepare("INSERT INTO otps(email,code_hash,purpose,expires_at) VALUES(?,?,?,?)")
   .run(email, hash, purpose, Date.now() + 10 * 60 * 1000);
 // Replace this development delivery with a verified email/SMS provider in production.
 console.log(`[DEV OTP] ${purpose} for ${email}: ${code}`);
 return code;
}

router.post("/register", (req,res) => {
 const parsed = registerSchema.safeParse(req.body);
 if (!parsed.success) return res.status(400).json({error:"Invalid registration data.", details:parsed.error.flatten()});
 const {name,email,password} = parsed.data;
 if (db.prepare("SELECT id FROM users WHERE email=?").get(email)) return res.status(409).json({error:"An account with this email already exists."});
 const hash = bcrypt.hashSync(password, 12);
 db.prepare("INSERT INTO users(name,email,password_hash,role,is_verified) VALUES(?,?,?,'client',0)").run(name,email,hash);
 const code = issueOtp(email,"verify");
 const response = {message:"Account created. Verify your email to activate it."};
 if (process.env.NODE_ENV !== "production" && process.env.DEV_RETURN_OTP === "true") response.devOtp = code;
 res.status(201).json(response);
});

router.post("/verify-otp", (req,res) => {
 const schema = z.object({email:z.string().email(), code:z.string().regex(/^\d{4}$/)});
 const p = schema.safeParse(req.body);
 if (!p.success) return res.status(400).json({error:"Valid email and 4-digit code are required."});
 const row = db.prepare("SELECT * FROM otps WHERE email=? AND purpose='verify' AND consumed_at IS NULL ORDER BY id DESC LIMIT 1").get(p.data.email);
 if (!row || row.expires_at < Date.now() || !bcrypt.compareSync(p.data.code,row.code_hash)) return res.status(400).json({error:"Invalid or expired verification code."});
 db.prepare("UPDATE otps SET consumed_at=? WHERE id=?").run(Date.now(),row.id);
 db.prepare("UPDATE users SET is_verified=1 WHERE email=?").run(p.data.email);
 res.json({message:"Email verified. You can now sign in."});
});

router.post("/resend-otp", (req,res) => {
 const p = z.object({email:z.string().email()}).safeParse(req.body);
 if (!p.success) return res.status(400).json({error:"Valid email is required."});
 const user = db.prepare("SELECT id,is_verified FROM users WHERE email=?").get(p.data.email);
 if (!user || user.is_verified) return res.json({message:"If the account needs verification, a code has been sent."});
 const code = issueOtp(p.data.email,"verify");
 const out = {message:"If the account needs verification, a code has been sent."};
 if (process.env.NODE_ENV !== "production" && process.env.DEV_RETURN_OTP === "true") out.devOtp=code;
 res.json(out);
});

router.post("/login", (req,res) => {
 const p = loginSchema.safeParse(req.body);
 if (!p.success) return res.status(400).json({error:"Email and password are required."});
 const user = db.prepare("SELECT * FROM users WHERE email=?").get(p.data.email);
 if (!user || !bcrypt.compareSync(p.data.password,user.password_hash)) return res.status(401).json({error:"Email or password is incorrect."});
 if (!user.is_verified) return res.status(403).json({error:"Please verify your email before signing in."});
 res.json({token:issueToken(user), user:publicUser(user)});
});

router.post("/forgot-password", (req,res) => {
 const p = z.object({email:z.string().email()}).safeParse(req.body);
 if (!p.success) return res.status(400).json({error:"Valid email is required."});
 const user = db.prepare("SELECT id FROM users WHERE email=?").get(p.data.email);
 const out = {message:"If this email is registered, password reset instructions will be sent."};
 if (user) {
   const code = issueOtp(p.data.email,"reset");
   if (process.env.NODE_ENV !== "production" && process.env.DEV_RETURN_OTP === "true") out.devOtp=code;
 }
 res.json(out);
});

router.post("/reset-password", (req,res) => {
 const p = z.object({email:z.string().email(),code:z.string().regex(/^\d{4}$/),newPassword:z.string().min(8).max(72)}).safeParse(req.body);
 if (!p.success) return res.status(400).json({error:"Email, 4-digit code and a password of at least 8 characters are required."});
 const row = db.prepare("SELECT * FROM otps WHERE email=? AND purpose='reset' AND consumed_at IS NULL ORDER BY id DESC LIMIT 1").get(p.data.email);
 if (!row || row.expires_at < Date.now() || !bcrypt.compareSync(p.data.code,row.code_hash)) return res.status(400).json({error:"Invalid or expired reset code."});
 const hash = bcrypt.hashSync(p.data.newPassword,12);
 const tx = db.transaction(() => {
   db.prepare("UPDATE users SET password_hash=? WHERE email=?").run(hash,p.data.email);
   db.prepare("UPDATE otps SET consumed_at=? WHERE id=?").run(Date.now(),row.id);
 });
 tx();
 res.json({message:"Password updated successfully. Please sign in again."});
});

router.get("/me", authenticate, (req,res) => res.json({user:req.user}));
module.exports = router;
