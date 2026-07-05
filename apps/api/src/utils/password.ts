import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";


const scrypt = promisify(_scrypt) as (
    password: string,
    salt: Buffer,
    keylen: number,
    options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_LEN = 64;
const SCRYPT_OPTS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const derivedKey = await scrypt(password, salt, KEY_LEN, SCRYPT_OPTS);
    return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    const [saltHex, keyHex] = stored.split(":");
    if (!saltHex || !keyHex) return false;

    const salt = Buffer.from(saltHex, "hex");
    const storedKey = Buffer.from(keyHex, "hex");

    const derivedKey = await scrypt(password, salt, KEY_LEN, SCRYPT_OPTS);

    if (derivedKey.length !== storedKey.length) return false;
    return timingSafeEqual(derivedKey, storedKey);
}

let dummyHashPromise: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
    if (!dummyHashPromise) {
        dummyHashPromise = hashPassword("invalid-password-placeholder");
    }
    return dummyHashPromise;
}