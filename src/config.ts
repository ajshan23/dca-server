import dotenv from "dotenv";

dotenv.config();

interface Config {
  env: string;
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  db: {
    url: string;
    logging: boolean;
  };
}

const config: Config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3001"),
  jwtSecret: process.env.JWT_SECRET || "your-secret-key",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") || "*",
    credentials: process.env.CORS_CREDENTIALS === "true"
  },
  db: {
    url: process.env.DATABASE_URL || "",
    logging: process.env.DB_LOGGING === "true"
  }
};

export default config;