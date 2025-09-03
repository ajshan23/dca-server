import { Request, Response } from "express";
import { AppError } from "../samples/errorHandler";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../database/db";

const BCRYPT_SALT_ROUNDS = 12;

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;

    if (!username?.trim() || !password?.trim()) {
      throw new AppError("Username and password are required", 400);
    }

    const user = await prisma.user.findFirst({
      where: { 
        username: { equals: username },
        deletedAt: null 
      }
    });

    if (!user) throw new AppError("Invalid credentials", 401);

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) throw new AppError("Invalid credentials", 401);

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      "your_secure_jwt_secret_32chars_min",
      { expiresIn: '180d' }
    );

  

    res.json({
      success: true,
      data: {
        token,
       
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      }
    });
  } catch (error) {
    throw error;
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const { username, password, role = "user" } = req.body;

    if (!username || !password) {
      throw new AppError("Username and password are required", 400);
    }

    if (password.length < 8) {
      throw new AppError("Password must be at least 8 characters", 400);
    }

    if (role === 'super_admin' && req.user?.role !== 'super_admin') {
      throw new AppError("Only super admin can create super admin users", 403);
    }

    const existingUser = await prisma.user.findFirst({
      where: { 
        username: { equals: username },
        deletedAt: null 
      }
    });

    if (existingUser) throw new AppError("Username already exists", 409);

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: hashedPassword,
        role
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true
      }
    });

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      throw new AppError("Username already exists", 409);
    }
    throw error;
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { username, password, role } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!user) throw new AppError("User not found", 404);

    // Prevent privilege escalation
    if (role && role !== user.role) {
      if (req.user?.role !== 'super_admin') {
        throw new AppError("Only super admin can change roles", 403);
      }
      if (user.role === 'super_admin') {
        throw new AppError("Cannot modify super admin role", 403);
      }
    }

    const updateData: {
      username?: string;
      passwordHash?: string;
      role?: string;
    } = {};

    if (username && username !== user.username) {
      const existingUser = await prisma.user.findFirst({
        where: { 
          username: { equals: username },
          deletedAt: null 
        }
      });
      if (existingUser) throw new AppError("Username already exists", 409);
      updateData.username = username;
    }

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    }

    if (role) {
      updateData.role = role;
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