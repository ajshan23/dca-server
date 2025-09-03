import { Request, Response, NextFunction } from "express";
import { UserRole } from "../constant/roles";
export declare function authorizeRoles(...roles: UserRole[]): (req: Request, _res: Response, next: NextFunction) => void;
