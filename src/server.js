require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const authRoutes = require("./routes/auth");
const resourceRoutes = require("./routes/resources");
require("./db");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
 console.error("JWT_SECRET must be set to a random string of at least 32 characters.");
 process.exit(1);
}
const app=express();
app.disable("x-powered-by");
app.use(helmet());
const allowed=(process.env.CLIENT_ORIGIN||"http://localhost:5500").split(",").map(s=>s.trim());
app.use(cors({origin:(origin,cb)=>!origin||allowed.includes(origin)?cb(null,true):cb(new Error("CORS origin not allowed")),credentials:true}));
app.use(express.json({limit:"1mb"}));
app.use("/api/auth",rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:"draft-7",legacyHeaders:false}),authRoutes);
app.use("/api",resourceRoutes);
app.get("/api/health",(req,res)=>res.json({status:"ok",service:"Freelancer Jakaria Nexus API",time:new Date().toISOString()}));
app.use((err,req,res,next)=>{
 console.error(err);
 if(err instanceof z.ZodError)return res.status(400).json({error:"Validation failed",details:err.flatten()});
 res.status(500).json({error:process.env.NODE_ENV==="production"?"Internal server error":err.message});
});
const port=Number(process.env.PORT)||4000;
app.listen(port,()=>console.log(`Nexus API listening at http://localhost:${port}`));
