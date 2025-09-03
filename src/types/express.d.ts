declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
        username:string;
      };
    }
  }
}
export {};