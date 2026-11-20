import { backup, type DatabaseSync } from 'node:sqlite'

/** Consistent online copy of the database (safe while the app is using it). */
export async function backupDb(db: DatabaseSync, destPath: string): Promise<void> {
  await backup(db, destPath)
}
