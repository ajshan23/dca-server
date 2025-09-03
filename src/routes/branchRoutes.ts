import express from "express";
import {
  createBranch,
  getAllBranches,
  getBranchById,
  updateBranch,
  deleteBranch
} from "../controllers/branchController";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/roleMiddleware";
import { UserRole } from "../constant/roles";

const router = express.Router();

router.post("/", authenticateJWT, authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN), createBranch);
router.get("/", getAllBranches);
router.get("/:id", getBranchById);
router.put("/:id", authenticateJWT, authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN), updateBranch);
router.delete("/:id", authenticateJWT, authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN), deleteBranch);

export default router;