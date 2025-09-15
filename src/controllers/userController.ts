import { Request, Response } from "express";
import { AppError } from "../samples/errorHandler";
import bcrypt from "bcryptjs";
import prisma from "../database/db";

const BCRYPT_SALT_ROUNDS = 12;

export async function getAllUsers(req: Request, res: Response) {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    const where: any = { deletedAt: null };
    
    if (search) {
      where.username = { contains: search as string, mode: 'insensitive' };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        where,
        select: {
          id: true,
          username: true,
          role: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: {
          username: 'asc'
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    throw new AppError("Failed to fetch users", 500);
  }
}

export async function getCurrentUser(req: Request, res: Response) {
  try {
    if (!req.user) throw new AppError("Authentication required", 401);
    
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.user.userId) },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true
      }
    });
    
    if (!user) throw new AppError("User not found", 404);
    
    res.json({ success: true, data: user });
  } catch (error) {
    throw error;
  }
}

export async function getUserById(req: Request, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) throw new AppError("User not found", 404);
    
    res.json({ success: true, data: user });
  } catch (error) {
    throw error;
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { username, password } = req.body;

    if (!req.user) throw new AppError("Authentication required", 401);

    // Users can only update their own profile unless they're admin
    if (parseInt(req.user.userId) !== parseInt(id) && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      throw new AppError("You can only update your own profile", 403);
    }

    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!user) throw new AppError("User not found", 404);

    const updateData: { username?: string; passwordHash?: string } = {};

    if (username && username !== user.username) {
      const existingUser = await prisma.user.findFirst({
        where: { 
          username: { equals: username},
          deletedAt: null 
        }
      });
      if (existingUser) throw new AppError("Username already exists", 409);
      updateData.username = username;
    }

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        updatedAt: true
      }
    });

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    throw error;
  }
}

export async function updateUserRole(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!req.user || req.user.role !== 'super_admin') {
      throw new AppError("Only super admin can change roles", 403);
    }

    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!user) throw new AppError("User not found", 404);

    // Prevent modifying super admins
    if (user.role === 'super_admin') {
      throw new AppError("Cannot modify super admin role", 403);
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { role },
      select: {
        id: true,
        username: true,
        role: true
      }
    });

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    throw error;
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!req.user || req.user.role !== 'super_admin') {
      throw new AppError("Only super admin can delete users", 403);
    }

    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!user) throw new AppError("User not found", 404);

    // Prevent deleting super admins
    if (user.role === 'super_admin') {
      throw new AppError("Cannot delete super admin", 403);
    }

    // Soft delete
    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { deletedAt: new Date() }
    });

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    throw error;
  }
}

export async function checkUsernameAvailability(req: Request, res: Response) {
  try {
    const { username } = req.query;
    
    if (!username || typeof username !== 'string') {
      throw new AppError("Username is required", 400);
    }

    const existingUser = await prisma.user.findFirst({
      where: { 
        username: { equals: username },
        deletedAt: null 
      }
    });

    res.json({ available: !existingUser });
  } catch (error) {
    throw error;
  }
}

export async function changePassword(req: Request, res: Response) {
  console.log("hi");
  
  try {
    console.log("=== Change Password Request Received ===");
    console.log("Request Body:", req.body);

    if (!req.user) {
      console.log("Authentication required: No user found on request");
      throw new AppError("Authentication required", 401);
    }

    console.log("Authenticated User:", req.user);
    console.log("User ID type:", typeof req.user.userId, "value:", req.user.userId);

    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      console.log("Validation Error: Missing fields");
      throw new AppError(
        "Current password, new password, and confirmation are required",
        400
      );
    }

    if (newPassword !== confirmPassword) {
      console.log("Validation Error: New password and confirmation do not match");
      throw new AppError("New password and confirmation do not match", 400);
    }

    if (newPassword.length < 8) {
      console.log("Validation Error: New password too short");
      throw new AppError("New password must be at least 8 characters long", 400);
    }

    if (newPassword === currentPassword) {
      console.log("Validation Error: New password is same as current password");
      throw new AppError("New password must be different from current password", 400);
    }

    // Parse userId safely
    const userIdStr = String(req.user.userId);
    console.log('====================================');
    console.log("User ID String:", userIdStr);
    console.log('====================================');
    const userId = parseInt(userIdStr, 10);
    
    console.log("Parsed User ID:", userId, "from:", req.user.userId);
    console.log('====================================');
    console.log("Type of Parsed User ID:", typeof userId);
    console.log('====================================');
    if (isNaN(userId)) {
      console.log("Error: Invalid User ID - could not parse to number");
      throw new AppError("Invalid user IDs", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      console.log("Error: User not found");
      throw new AppError("User not found", 404);
    }

    if (user.deletedAt) {
      console.log("Error: User account deleted");
      throw new AppError("User account has been deleted", 400);
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      console.log("Error: Incorrect current password");
      throw new AppError("Current password is incorrect", 400);
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedNewPassword }
    });

    res.json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error("Error in changePassword:", error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  }
}