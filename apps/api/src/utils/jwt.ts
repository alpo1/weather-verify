import jwt, { type JwtPayload } from "jsonwebtoken";

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set`);
    }
    return value;
}

const secret = requireEnv("JWT_SECRET");
const TOKEN_TTL = "7d";

export type AuthTokenPayload = { userId: string };

export function signAuthToken(userId: string): string {
    return jwt.sign({ userId }, secret, { expiresIn: TOKEN_TTL });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
    const decoded: string | JwtPayload = jwt.verify(token, secret);
    if (typeof decoded === "string" || typeof decoded.userId !== "string") {
        throw new Error("invalid token payload");
    }
    return { userId: decoded.userId };
}