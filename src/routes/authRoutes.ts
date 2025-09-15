import express from "express";
import { login, createUser, updateUser } from "../controllers/authController";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/roleMiddleware";
import { UserRole } from "../constant/roles";
import { changePassword } from "@/controllers/userController";
const router = express.Router();

router.post("/login", login);
router.post("/register", authenticateJWT, authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN), createUser);
router.put("/change-password", authenticateJWT, changePassword);
router.put("/:id", authenticateJWT, authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN), updateUser);


export default router;