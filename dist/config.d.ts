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
declare const config: Config;
export default config;
