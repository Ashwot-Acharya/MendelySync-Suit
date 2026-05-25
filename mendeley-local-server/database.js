const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'references.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[Database] Error opening SQLite database:', err);
  } else {
    console.log('[Database] Connected to SQLite database at:', dbPath);
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS references_store (
        id TEXT PRIMARY KEY,
        title TEXT,
        type TEXT,
        authors TEXT,
        year INTEGER,
        source TEXT,
        abstract TEXT,
        doi TEXT,
        created TEXT,
        raw_json TEXT
      )
    `, (err) => {
      if (err) {
        console.error('[Database] Failed to create references table:', err);
      } else {
        console.log('[Database] References table verified.');
      }
    });
  });
}

/**
 * Bulk saves Mendeley references into SQLite using a transaction.
 * @param {Array} references 
 * @returns {Promise<number>} Number of records imported
 */
function saveReferences(references) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(references)) {
      return reject(new Error('References input must be an array'));
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO references_store 
        (id, title, type, authors, year, source, abstract, doi, created, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      try {
        for (const ref of references) {
          if (!ref.id) continue;

          // Parse authors list
          let authorsStr = '';
          if (ref.authors && Array.isArray(ref.authors)) {
            authorsStr = JSON.stringify(ref.authors);
          } else if (typeof ref.authors === 'string') {
            authorsStr = ref.authors;
          }

          // Fetch DOI
          let doi = '';
          if (ref.identifiers && ref.identifiers.doi) {
            doi = ref.identifiers.doi;
          }

          stmt.run(
            ref.id,
            ref.title || 'Untitled Reference',
            ref.type || 'generic',
            authorsStr,
            ref.year || null,
            ref.source || '',
            ref.abstract || '',
            doi,
            ref.created || '',
            JSON.stringify(ref)
          );
        }

        stmt.finalize((err) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }
          
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              db.run('ROLLBACK');
              return reject(commitErr);
            }
            resolve(references.length);
          });
        });
      } catch (err) {
        db.run('ROLLBACK');
        reject(err);
      }
    });
  });
}

/**
 * Retrieves all stored references sorted by year and date added.
 * @returns {Promise<Array>}
 */
function getAllReferences() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM references_store ORDER BY year DESC, created DESC', [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        // Map authors JSON string back to object array
        const parsedRows = rows.map(row => {
          let authors = [];
          try {
            authors = row.authors ? JSON.parse(row.authors) : [];
          } catch(e) {
            authors = row.authors ? [{ last_name: row.authors }] : [];
          }
          return {
            ...row,
            authors
          };
        });
        resolve(parsedRows);
      }
    });
  });
}

/**
 * Deletes all references in SQLite
 * @returns {Promise<void>}
 */
function clearDatabase() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM references_store', [], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

module.exports = {
  saveReferences,
  getAllReferences,
  clearDatabase
};
