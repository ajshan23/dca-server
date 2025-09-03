import express from "express";
import {
  getAllUsers,
  getCurrentUser,
  getUserById,
  updateUser,
  updateUserRole,
  deleteUser,
  checkUsernameAvailability
} from "../controllers/userController";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/roleMiddleware";
import { UserRole } from "../constant/roles";

const router = express.Router();

router.get("/", authenticateJWT, authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN), getAllUsers);
router.get("/me", authenticateJWT, getCurrentUser);
router.get("/check-username", checkUsernameAvailability);
router.get("/:id", authenticateJWT, authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN), getUserById);
router.put("/:id", authenticateJWT, updateUser);
router.patch("/:id/role", authenticateJWT, authorizeRoles(UserRole.SUPER_ADMIN), updateUserRole);
router.delete("/:id", authenticateJWT, authorizeRoles(UserRole.SUPER_ADMIN), deleteUser);

export default router;