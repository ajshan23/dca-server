// routes/publicRoutes.ts
import express from "express";
import {
  getPublicAssignmentInfo,
  getPublicInventoryInfo
} from "../controllers/publicController";

const router = express.Router();

// Public routes (no authentication required)
// These routes are designed for QR code scanning and public access
router.get("/assignment/:assignmentId", getPublicAssignmentInfo);
router.get("/inventory/:inventoryId", getPublicInventoryInfo);

export default router;