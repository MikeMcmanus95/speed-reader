import { LocalDocumentStorage } from './local';
import { RemoteDocumentStorage } from './remote';

const MIGRATION_KEY = 'speed-reader:migrated-users';

export interface MigrationResult {
  totalDocuments: number;
  migratedDocuments: number;
  failedDocuments: string[];
}

/**
 * Service for migrating local documents to the backend when a user signs in.
 */
export class MigrationService {
  private localStorage: LocalDocumentStorage;
  private remoteStorage: RemoteDocumentStorage;

  constructor() {
    this.localStorage = new LocalDocumentStorage();
    this.remoteStorage = new RemoteDocumentStorage();
  }

  /**
   * Check if there are any local documents to migrate.
   */
  async hasLocalDocuments(): Promise<boolean> {
    return this.localStorage.hasDocuments();
  }

  /**
   * Migrate all local documents to the backend.
   * This is called when a user signs in (either new signup or returning user).
   *
   * @param userId The authenticated user's ID
   * @returns Migration result with success/failure counts
   */
  async migrateLocalDocuments(userId: string): Promise<MigrationResult> {
    // Check if already migrated for this user
    if (this.wasPreviouslyMigrated(userId)) {
      return {
        totalDocuments: 0,
        migratedDocuments: 0,
        failedDocuments: [],
      };
    }

    // Get all local documents with their content
    const localDocs = await this.localStorage.getAllDocumentsWithContent();

    if (localDocs.length === 0) {
      this.markAsMigrated(userId);
      return {
        totalDocuments: 0,
        migratedDocuments: 0,
        failedDocuments: [],
      };
    }

    const result: MigrationResult = {
      totalDocuments: localDocs.length,
      migratedDocuments: 0,
      failedDocuments: [],
    };

    // Migrate each document to the backend
    for (const { document, content } of localDocs) {
      try {
        // Create document on backend using RemoteDocumentStorage
        await this.remoteStorage.createDocument(content, document.title);
        result.migratedDocuments++;
      } catch (err) {
        console.error(`Failed to migrate document "${document.title}":`, err);
        result.failedDocuments.push(document.title);
      }
    }

    // Only clear local storage if ALL documents migrated successfully
    if (result.failedDocuments.length === 0) {
      await this.localStorage.clearAllDocuments();
      this.markAsMigrated(userId);
    }

    return result;
  }

  /**
   * Check if a user has already completed migration.
   */
  private wasPreviouslyMigrated(userId: string): boolean {
    try {
      const migrated = window.localStorage.getItem(MIGRATION_KEY);
      if (!migrated) return false;
      const users = JSON.parse(migrated) as string[];
      return users.includes(userId);
    } catch {
      return false;
    }
  }

  /**
   * Mark a user as having completed migration.
   */
  private markAsMigrated(userId: string): void {
    try {
      const migrated = window.localStorage.getItem(MIGRATION_KEY);
      const users = migrated ? (JSON.parse(migrated) as string[]) : [];
      if (!users.includes(userId)) {
        users.push(userId);
        window.localStorage.setItem(MIGRATION_KEY, JSON.stringify(users));
      }
    } catch {
      // Ignore localStorage errors
    }
  }
}
