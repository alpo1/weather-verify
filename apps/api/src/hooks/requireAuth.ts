import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAuthToken } from "../utils/jwt";

declare module "fastify" {
    interface FastifyRequest {
        userId?: string;
    }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies.token;
    if (!token) {
        return reply.code(401).send({ error: "authentication required" });
    }
    try {
        const { userId } = verifyAuthToken(token);
        request.userId = userId;
    } catch {
        return reply.code(401).send({ error: "invalid or expired token" });
    }
}