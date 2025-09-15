import { syncEmployees } from "../controllers/employeeSyncController";
import { authenticateJWT } from "../middlewares/authMiddleware";
import express from "express";
const router = express.Router();



router.post("/sync", syncEmployees);

export default router;