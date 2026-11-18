const express = require("express");
const { z } = require("zod");
const db = require("../db");
const { authenticate, allowRoles } = require("../middleware/auth");
const { makePublicCode } = require("../utils");
const router = express.Router();
router.use(authenticate);

const config = {
 projects:{table:"projects",fields:["name","description","status","progress","client_id","due_date"],adminWrite:true},
 orders:{table:"orders",fields:["client_id","service","amount","currency","status"],adminWrite:true},
 products:{table:"products",fields:["name","category","description","price","active"],adminWrite:true},
 tasks:{table:"tasks",fields:["title","description","project_id","assigned_to","status","due_date"],adminWrite:true},
 invoices:{table:"invoices",fields:["client_id","order_id","amount","currency","status","due_date"],adminWrite:true}
};
function parseId(v){const n=Number(v);return Number.isInteger(n)&&n>0?n:null}
for (const [resource,cfg] of Object.entries(config)) {
 router.get(`/${resource}`, (req,res) => {
   let rows;
   if (req.user.role === "admin" || req.user.role === "employee") rows=db.prepare(`SELECT * FROM ${cfg.table} ORDER BY id DESC`).all();
   else if (resource==="orders" || resource==="invoices") rows=db.prepare(`SELECT * FROM ${cfg.table} WHERE client_id=? ORDER BY id DESC`).all(req.user.id);
   else rows=[];
   res.json({data:rows});
 });
 router.post(`/${resource}`, allowRoles("admin","employee"), (req,res) => {
   const body={};
   for (const f of cfg.fields) if (req.body[f] !== undefined) body[f]=req.body[f];
   if (!body.name && resource==="products") return res.status(400).json({error:"name is required"});
   if (!body.name && resource==="projects") return res.status(400).json({error:"name is required"});
   if (!body.service && resource==="orders") return res.status(400).json({error:"service is required"});
   if (!body.title && resource==="tasks") return res.status(400).json({error:"title is required"});
   if (["amount","price","progress"].some(k=>body[k]!==undefined && (!Number.isFinite(Number(body[k])) || Number(body[k])<0))) return res.status(400).json({error:"Numeric values must be non-negative."});
   if (body.progress!==undefined && Number(body.progress)>100) return res.status(400).json({error:"progress cannot exceed 100"});
   if (resource==="orders") body.order_code=makePublicCode("ORD");
   if (resource==="invoices") body.invoice_code=makePublicCode("INV");
   const fields=Object.keys(body);
   const sql=`INSERT INTO ${cfg.table} (${fields.join(",")}) VALUES (${fields.map(()=>"?").join(",")})`;
   const result=db.prepare(sql).run(...fields.map(k=>body[k]));
   const row=db.prepare(`SELECT * FROM ${cfg.table} WHERE id=?`).get(result.lastInsertRowid);
   res.status(201).json({data:row});
 });
 router.patch(`/${resource}/:id`, allowRoles("admin","employee"), (req,res) => {
   const id=parseId(req.params.id); if(!id)return res.status(400).json({error:"Invalid id"});
   const body={}; for(const f of cfg.fields) if(req.body[f]!==undefined)body[f]=req.body[f];
   const fields=Object.keys(body); if(!fields.length)return res.status(400).json({error:"No supported fields supplied."});
   const result=db.prepare(`UPDATE ${cfg.table} SET ${fields.map(f=>`${f}=?`).join(",")} WHERE id=?`).run(...fields.map(k=>body[k]),id);
   if(!result.changes)return res.status(404).json({error:"Record not found"});
   res.json({data:db.prepare(`SELECT * FROM ${cfg.table} WHERE id=?`).get(id)});
 });
 router.delete(`/${resource}/:id`, allowRoles("admin"), (req,res) => {
   const id=parseId(req.params.id); if(!id)return res.status(400).json({error:"Invalid id"});
   const result=db.prepare(`DELETE FROM ${cfg.table} WHERE id=?`).run(id);
   if(!result.changes)return res.status(404).json({error:"Record not found"});
   res.json({message:"Record deleted"});
 });
}
router.get("/clients",allowRoles("admin","employee"),(req,res)=>{
 const rows=db.prepare("SELECT id,name,email,role,is_verified,created_at FROM users WHERE role='client' ORDER BY id DESC").all();
 res.json({data:rows});
});
router.get("/team",allowRoles("admin","employee"),(req,res)=>{
 const rows=db.prepare("SELECT id,name,email,role,is_verified,created_at FROM users WHERE role IN ('admin','employee') ORDER BY id").all();
 res.json({data:rows});
});
router.post("/team",allowRoles("admin"),(req,res)=>{
 const p=z.object({name:z.string().min(2),email:z.string().email(),password:z.string().min(8),role:z.enum(["employee","client"]).default("employee")}).safeParse(req.body);
 if(!p.success)return res.status(400).json({error:"Invalid team member data",details:p.error.flatten()});
 const bcrypt=require("bcryptjs");
 try{
  const hash=bcrypt.hashSync(p.data.password,12);
  const info=db.prepare("INSERT INTO users(name,email,password_hash,role,is_verified) VALUES(?,?,?,?,1)").run(p.data.name,p.data.email,hash,p.data.role);
  res.status(201).json({data:db.prepare("SELECT id,name,email,role,is_verified FROM users WHERE id=?").get(info.lastInsertRowid)});
 }catch(e){if(String(e).includes("UNIQUE"))return res.status(409).json({error:"Email already exists"});throw e}
});
router.get("/dashboard/summary",allowRoles("admin","employee"),(req,res)=>{
 const count=(table)=>db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
 const revenue=db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM orders WHERE status='paid'").get().total;
 res.json({data:{users:count("users"),projects:count("projects"),orders:count("orders"),products:count("products"),tasks:count("tasks"),paidRevenue:revenue}});
});
module.exports=router;
