import { Request, Response } from "express";
export declare function getAllUsers(req: Request, res: Response): Promise<void>;
export declare function getCurrentUser(req: Request, res: Response): Promise<void>;
export declare function getUserById(req: Request, res: Response): Promise<void>;
export declare function updateUser(req: Request, res: Response): Promise<void>;
export declare function updateUserRole(req: Request, res: Response): Promise<void>;
export declare function deleteUser(req: Request, res: Response): Promise<void>;
export declare function checkUsernameAvailability(req: Request, res: Response): Promise<void>;
