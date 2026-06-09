import fs from "node:fs";
import path from "node:path";
import type {
  StorageProvider,
  StoredConversation,
  ConversationSummary,
} from "./types";
import { logger } from "../core/logger";

/**
 * Local JSON file storage — default provider.
 * Stores each conversation as a separate JSON file in data/conversations/.
 */

const DATA_DIR = path.join(process.cwd(), "data", "conversations");

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function filePath(id: string): string {
  return path.join(DATA_DIR, `${id}.json`);
}

export const localStorage: StorageProvider = {
  async list(): Promise<ConversationSummary[]> {
    ensureDir();
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));

    const summaries: ConversationSummary[] = [];
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
        const conv: StoredConversation = JSON.parse(raw);
        summaries.push({
          id: conv.id,
          title: conv.title,
          modeId: conv.modeId,
          createdAt: conv.createdAt,
          messageCount: 1,
        });
      } catch {
        logger.debug("Skipping corrupt conversation file", { file });
      }
    }

    // Newest first
    summaries.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return summaries;
  },

  async get(id: string): Promise<StoredConversation | null> {
    const fp = filePath(id);
    if (!fs.existsSync(fp)) return null;
    try {
      const raw = fs.readFileSync(fp, "utf-8");
      return JSON.parse(raw) as StoredConversation;
    } catch {
      logger.error("Failed to read conversation", { id });
      return null;
    }
  },

  async save(conversation: StoredConversation): Promise<void> {
    ensureDir();
    const fp = filePath(conversation.id);
    fs.writeFileSync(fp, JSON.stringify(conversation, null, 2), "utf-8");
    logger.debug("Conversation saved", {
      id: conversation.id,
      title: conversation.title,
    });
  },

  async delete(id: string): Promise<void> {
    const fp = filePath(id);
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
      logger.debug("Conversation deleted", { id });
    }
  },
};
