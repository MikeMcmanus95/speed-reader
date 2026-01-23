import type {
  Document,
  DocumentWithProgress,
  Chunk,
  ReadingState,
  UpdateReadingStateRequest,
  GetContentResponse,
} from '@speed-reader/types';
import { tokenize, chunkTokens } from '@speed-reader/tokenizer';
import type { ILocalDocumentStorage } from '../interfaces/IDocumentStorage';
import { LocalDatabase } from './LocalDatabase';

const CHUNK_SIZE = 5000;

// Random title generation (matching backend namegen.go)
const ADJECTIVES = [
  // Nocturnal/atmospheric
  'Midnight', 'Twilight', 'Starlit', 'Moonlit', 'Shadowy',
  'Velvet', 'Dusky', 'Amber', 'Crimson', 'Golden',
  // Intellectual/scholarly
  'Curious', 'Wandering', 'Ancient', 'Mystic', 'Wise',
  'Noble', 'Clever', 'Swift', 'Silent', 'Whispering',
  // Nature-inspired
  'Emerald', 'Silver', 'Sapphire', 'Copper', 'Ivory',
  'Gentle', 'Radiant', 'Hidden', 'Forgotten', 'Eternal',
];

const NOUNS = [
  // Creatures (nocturnal/wise)
  'Owl', 'Raven', 'Fox', 'Wolf', 'Moth',
  'Hare', 'Badger', 'Hedgehog', 'Finch', 'Wren',
  // Scholarly figures
  'Scholar', 'Scribe', 'Sage', 'Bard', 'Poet',
  'Reader', 'Dreamer', 'Wanderer', 'Seeker', 'Keeper',
  // Literary objects
  'Quill', 'Scroll', 'Tome', 'Chronicle', 'Sonnet',
  'Ballad', 'Fable', 'Verse', 'Chapter', 'Inkwell',
];

function generateRandomTitle(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective} ${noun}`;
}

/**
 * Local document storage implementation using IndexedDB.
 * Used for unauthenticated users.
 */
export class LocalDocumentStorage implements ILocalDocumentStorage {
  private db: LocalDatabase;

  constructor() {
    this.db = new LocalDatabase();
  }

  async createDocument(content: string, title?: string): Promise<Document> {
    // Generate UUID
    const id = crypto.randomUUID();

    // Client-side tokenization
    const tokens = tokenize(content);
    const chunks = chunkTokens(tokens, CHUNK_SIZE);

    // Generate title if not provided
    const finalTitle = title?.trim() || generateRandomTitle();

    const document: Document = {
      id,
      title: finalTitle,
      status: 'ready',
      tokenCount: tokens.length,
      chunkCount: chunks.length,
      visibility: 'private',
      createdAt: new Date().toISOString(),
      hasContent: true,
    };

    // Save to IndexedDB
    await this.db.saveDocument(document, chunks, content);

    return document;
  }

  async getDocument(id: string): Promise<Document> {
    const doc = await this.db.getDocument(id);
    if (!doc) {
      throw new Error('Document not found');
    }

    // Return document without content (content is internal)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { content, ...document } = doc;
    return document;
  }

  async listDocuments(): Promise<DocumentWithProgress[]> {
    return this.db.listDocuments();
  }

  async updateDocument(id: string, title: string, content?: string): Promise<Document> {
    if (content !== undefined) {
      // Re-tokenize if content is provided
      const tokens = tokenize(content);
      const chunks = chunkTokens(tokens, CHUNK_SIZE);
      const doc = await this.db.updateDocumentContent(id, title, content, chunks, tokens.length);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { content: _, ...document } = doc;
      return document;
    } else {
      // Just update title
      await this.db.updateDocumentTitle(id, title);
      return this.getDocument(id);
    }
  }

  async deleteDocument(id: string): Promise<void> {
    await this.db.deleteDocument(id);
  }

  async getTokens(id: string, chunkIndex: number): Promise<Chunk> {
    const tokens = await this.db.getChunk(id, chunkIndex);
    if (!tokens) {
      throw new Error(`Chunk ${chunkIndex} not found for document ${id}`);
    }

    return {
      chunkIndex,
      tokens,
    };
  }

  async getReadingState(id: string): Promise<ReadingState> {
    const state = await this.db.getReadingState(id);

    if (!state) {
      // Return default state if none exists
      return {
        docId: id,
        tokenIndex: 0,
        wpm: 300,
        chunkSize: 1,
        updatedAt: new Date().toISOString(),
      };
    }

    return state;
  }

  async updateReadingState(id: string, request: UpdateReadingStateRequest): Promise<ReadingState> {
    const state: ReadingState = {
      docId: id,
      tokenIndex: request.tokenIndex,
      wpm: request.wpm,
      chunkSize: request.chunkSize,
      updatedAt: new Date().toISOString(),
    };

    await this.db.updateReadingState(state);
    return state;
  }

  async getDocumentContent(id: string): Promise<GetContentResponse> {
    const content = await this.db.getContent(id);
    return {
      content: content ?? '',
      hasContent: content !== null,
    };
  }

  // Migration support methods

  async getAllDocumentsWithContent(): Promise<Array<{ document: Document; content: string }>> {
    return this.db.getAllDocumentsWithContent();
  }

  async clearAllDocuments(): Promise<void> {
    await this.db.clearAllDocuments();
  }

  async hasDocuments(): Promise<boolean> {
    return this.db.hasDocuments();
  }
}
