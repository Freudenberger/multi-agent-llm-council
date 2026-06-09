import fs from "node:fs";
import path from "node:path";
import type { User } from "./types";
import { logger } from "../core/logger";

/**
 * Simple file-based user storage for local development.
 * In production with Supabase, this would be replaced by database queries.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readUsers(): User[] {
  ensureDir();
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(raw) as User[];
  } catch {
    return [];
  }
}

function writeUsers(users: User[]): void {
  ensureDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

export const userStorage = {
  findByEmail(email: string): User | null {
    const users = readUsers();
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
  },

  findById(id: string): User | null {
    const users = readUsers();
    return users.find((u) => u.id === id) ?? null;
  },

  create(user: User): void {
    const users = readUsers();
    users.push(user);
    writeUsers(users);
    logger.info("User created", { id: user.id, email: user.email });
  },

  getAll(): User[] {
    return readUsers();
  },
};
