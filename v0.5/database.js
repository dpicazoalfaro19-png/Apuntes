/**
 * database.js
 * Capa de acceso a IndexedDB para "Mis Apuntes IA".
 * Gestiona la creación de la base de datos, las materias iniciales
 * y las operaciones CRUD necesarias para materias y apuntes.
 */

const DB_NAME = 'mis-apuntes-ia-db';
const DB_VERSION = 2;
const STORE_SUBJECTS = 'subjects';
const STORE_NOTES = 'notes';
const STORE_TRASH = 'trash';

const INITIAL_SUBJECTS = ['Biología', 'Ciencias Sociales', 'Informática'];

let dbInstance = null;

/**
 * Elimina tildes y pasa a minúsculas, útil para comparar nombres de materias.
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Abre (o crea) la base de datos IndexedDB y garantiza que existan
 * las materias iniciales si la base de datos está vacía.
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('No se pudo abrir la base de datos IndexedDB.'));
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_SUBJECTS)) {
        const subjectsStore = db.createObjectStore(STORE_SUBJECTS, { keyPath: 'id' });
        subjectsStore.createIndex('normalizedName', 'normalizedName', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_TRASH)) {
        const trashStore = db.createObjectStore(STORE_TRASH, { keyPath: 'id' });
        trashStore.createIndex('deletedAt', 'deletedAt', { unique: false });
        trashStore.createIndex('subjectName', 'subjectName', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NOTES)) {
        const notesStore = db.createObjectStore(STORE_NOTES, { keyPath: 'id' });
        notesStore.createIndex('subjectId', 'subjectId', { unique: false });
        notesStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = async (event) => {
      dbInstance = event.target.result;
      try {
        await ensureInitialSubjects();
        resolve(dbInstance);
      } catch (error) {
        reject(error);
      }
    };
  });
}

/**
 * Genera un identificador único razonablemente simple.
 * @returns {string}
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Comprueba si ya existen materias; si no, crea las materias iniciales.
 * @returns {Promise<void>}
 */
async function ensureInitialSubjects() {
  const existingSubjects = await getAllSubjects();
  if (existingSubjects.length > 0) {
    return;
  }

  for (const name of INITIAL_SUBJECTS) {
    await createSubject(name);
  }
}

/**
 * Crea una nueva materia en la base de datos.
 * @param {string} name
 * @returns {Promise<Object>}
 */
async function createSubject(name) {
  const normalized = normalizeText(name);
  const existing = await findSubjectByNormalizedName(normalized);
  if (existing) {
    return existing;
  }

  return new Promise((resolve, reject) => {
    const subject = {
      id: generateId(),
      name: name.trim(),
      normalizedName: normalized,
      createdAt: new Date().toISOString(),
    };

    const transaction = dbInstance.transaction([STORE_SUBJECTS], 'readwrite');
    const store = transaction.objectStore(STORE_SUBJECTS);
    const request = store.add(subject);

    request.onsuccess = () => resolve(subject);
    request.onerror = () => reject(new Error('No se pudo crear la materia.'));
  });
}

/**
 * Devuelve todas las materias almacenadas.
 * @returns {Promise<Array<Object>>}
 */
function getAllSubjects() {
  return new Promise((resolve, reject) => {
    if (!dbInstance) {
      resolve([]);
      return;
    }
    const transaction = dbInstance.transaction([STORE_SUBJECTS], 'readonly');
    const store = transaction.objectStore(STORE_SUBJECTS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error('No se pudieron obtener las materias.'));
  });
}

/**
 * Busca una materia cuyo nombre normalizado coincida (parcial o total)
 * con el texto proporcionado.
 * @param {string} normalizedQuery
 * @returns {Promise<Object|null>}
 */
async function findSubjectByNormalizedName(normalizedQuery) {
  const subjects = await getAllSubjects();

  const exactMatch = subjects.find((s) => s.normalizedName === normalizedQuery);
  if (exactMatch) return exactMatch;

  const partialMatch = subjects.find(
    (s) => normalizedQuery.includes(s.normalizedName) || s.normalizedName.includes(normalizedQuery)
  );
  return partialMatch || null;
}

/**
 * Guarda un nuevo apunte en la base de datos.
 * @param {Object} noteData
 * @returns {Promise<Object>}
 */
function createNote(noteData) {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const note = {
      id: generateId(),
      subjectId: noteData.subjectId,
      subjectName: noteData.subjectName,
      title: noteData.title,
      content: noteData.content,
      createdAt: now.toISOString(),
      date: now.toLocaleDateString('es-ES'),
      time: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      durationSeconds: noteData.durationSeconds || 0,
    };

    const transaction = dbInstance.transaction([STORE_NOTES], 'readwrite');
    const store = transaction.objectStore(STORE_NOTES);
    const request = store.add(note);

    request.onsuccess = () => resolve(note);
    request.onerror = () => reject(new Error('No se pudo guardar el apunte.'));
  });
}

/**
 * Devuelve todos los apuntes, ordenados del más reciente al más antiguo.
 * @returns {Promise<Array<Object>>}
 */
function getAllNotes() {
  return new Promise((resolve, reject) => {
    if (!dbInstance) {
      resolve([]);
      return;
    }
    const transaction = dbInstance.transaction([STORE_NOTES], 'readonly');
    const store = transaction.objectStore(STORE_NOTES);
    const request = store.getAll();

    request.onsuccess = () => {
      const notes = request.result || [];
      notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(notes);
    };
    request.onerror = () => reject(new Error('No se pudieron obtener los apuntes.'));
  });
}

/**
 * Devuelve los apuntes de una materia concreta.
 * @param {string} subjectId
 * @returns {Promise<Array<Object>>}
 */
function getNotesBySubject(subjectId) {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction([STORE_NOTES], 'readonly');
    const store = transaction.objectStore(STORE_NOTES);
    const index = store.index('subjectId');
    const request = index.getAll(subjectId);

    request.onsuccess = () => {
      const notes = request.result || [];
      notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(notes);
    };
    request.onerror = () => reject(new Error('No se pudieron obtener los apuntes de la materia.'));
  });
}

/**
 * Elimina un apunte por su ID.
 * @param {string} noteId
 * @returns {Promise<void>}
 */
function deleteNote(noteId) {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction([STORE_NOTES, STORE_TRASH], 'readwrite');
    const notes = transaction.objectStore(STORE_NOTES);
    const trash = transaction.objectStore(STORE_TRASH);
    const getRequest = notes.get(noteId);
    getRequest.onsuccess = () => {
      const note = getRequest.result;
      if (!note) { resolve(); return; }
      trash.put({ ...note, deletedAt: new Date().toISOString() });
      notes.delete(noteId);
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('No se pudo mover el apunte a la papelera.'));
  });
}

function getTrashNotes() {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction([STORE_TRASH], 'readonly');
    const req = tx.objectStore(STORE_TRASH).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a,b)=>new Date(b.deletedAt)-new Date(a.deletedAt)));
    req.onerror = () => reject(new Error('No se pudo leer la papelera.'));
  });
}

async function deleteSubject(subjectId) {
  const subject = (await getAllSubjects()).find(s => s.id === subjectId);
  if (!subject) return;
  const notes = await getNotesBySubject(subjectId);
  for (const note of notes) await deleteNote(note.id);
  return new Promise((resolve,reject)=>{
    const tx=dbInstance.transaction([STORE_SUBJECTS],'readwrite');
    tx.objectStore(STORE_SUBJECTS).delete(subjectId);
    tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(new Error('No se pudo eliminar la materia.'));
  });
}

/**
 * Actualiza el título y/o contenido de un apunte existente.
 * @param {string} noteId
 * @param {Object} changes - { title, content }
 * @returns {Promise<Object>}
 */
function updateNote(noteId, changes) {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction([STORE_NOTES], 'readwrite');
    const store = transaction.objectStore(STORE_NOTES);
    const getRequest = store.get(noteId);

    getRequest.onsuccess = () => {
      const note = getRequest.result;
      if (!note) {
        reject(new Error('Apunte no encontrado.'));
        return;
      }

      if (typeof changes.title === 'string') note.title = changes.title;
      if (typeof changes.content === 'string') note.content = changes.content;

      const putRequest = store.put(note);
      putRequest.onsuccess = () => resolve(note);
      putRequest.onerror = () => reject(new Error('No se pudo actualizar el apunte.'));
    };
    getRequest.onerror = () => reject(new Error('No se pudo leer el apunte a actualizar.'));
  });
}

window.AppDatabase = {
  openDatabase,
  normalizeText,
  getAllSubjects,
  findSubjectByNormalizedName,
  createSubject,
  createNote,
  updateNote,
  getAllNotes,
  getNotesBySubject,
  deleteNote,
  getTrashNotes,
  deleteSubject,
};
