import express from "express";
import {
  assignProduct,
  returnProduct,
  getActiveAssignments,
  getAssignmentHistory,
  getEmployeeAssignments,
  updateAssignment,
  getProductAssignments,
  getAssignmentAnalytics, // ✅ new import
} from "../controllers/productAssignmentController";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/roleMiddleware";
import { UserRole } from "../constant/roles";

const router = express.Router();

router.post(
  "/assign",
  authenticateJWT,
  authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.USER),
  assignProduct
);


router.get(
  "/product/:productId",
  authenticateJWT,
  getProductAssignments
);

router.post(
  "/return/:assignmentId",
  authenticateJWT,
  authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.USER),
  returnProduct
);

router.get("/active", authenticateJWT, getActiveAssignments);
router.get("/history", authenticateJWT, getAssignmentHistory);
router.get("/employee/:employeeId", authenticateJWT, getEmployeeAssignments);
router.put("/:assignmentId", authenticateJWT, updateAssignment);

// ✅ New route for analytics
router.get("/analytics", authenticateJWT, getAssignmentAnalytics);

export default router;
