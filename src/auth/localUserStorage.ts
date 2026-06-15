import fs from "node:fs";
import path from "node:path";
import type { User, ProviderSettings, UserStorage } from "./types";
import { logger } from "../core/logger";

/**
 * Local JSON file user storage — default provider (DB_PROVIDER=local).
 * Stores all users in a single data/users.json file.
 *
 * The methods are async to satisfy the UserStorage contract (shared with the
 * Supabase provider); the underlying file I/O is synchronous.
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

export const localUserStorage: UserStorage = {
  async findByEmail(email: string): Promise<User | null> {
    const users = readUsers();
    return (
      users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null
    );
  },

  async findById(id: string): Promise<User | null> {
    const users = readUsers();
    return users.find((u) => u.id === id) ?? null;
  },

  async create(user: User): Promise<void> {
    const users = readUsers();
    users.push(user);
    writeUsers(users);
    logger.info("User created", { id: user.id, email: user.email });
  },

  async getAll(): Promise<User[]> {
    return readUsers();
  },

  async updateProviderSettings(
    userId: string,
    providerSettings: ProviderSettings,
  ): Promise<User | null> {
    const users = readUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) return null;
    users[index] = { ...users[index], providerSettings };
    writeUsers(users);
    logger.info("User provider settings updated", { userId });
    return users[index];
  },

  async updatePreferredModels(
    userId: string,
    preferredModels: string[],
  ): Promise<User | null> {
    const users = readUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) return null;
    users[index] = { ...users[index], preferredModels };
    writeUsers(users);
    logger.info("User preferred models updated", {
      userId,
      count: preferredModels.length,
    });
    return users[index];
  },
};
