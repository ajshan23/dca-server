import express from "express";
import { getDashboardData } from "../controllers/dashboardController";
import { authenticateJWT } from "../middlewares/authMiddleware";

const router = express.Router();

router.get("/", authenticateJWT, getDashboardData);

export default router;