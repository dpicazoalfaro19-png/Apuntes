/**
 * app.js
 * Coordina la interfaz de chat, la barra de materias, la personalización
 * (tema claro/oscuro), la creación de apuntes (manual y por voz), y la
 * navegación hacia la pantalla de apuntes.
 */

(function () {
  // ---------- Referencias generales ----------
  const chatShell = document.getElementById('chat-shell');
  const notesShell = document.getElementById('notes-shell');

  const subjectsListEl = document.getElementById('subjects-list');
  const chatLogEl = document.getElementById('chat-log');
  const chatInputForm = document.getElementById('chat-input-form');
  const chatTextInput = document.getElementById('chat-text-input');
  const chatMicBtn = document.getElementById('chat-mic-btn');

  const plusMenuBtn = document.getElementById('plus-menu-btn');
  const plusMenu = document.getElementById('plus-menu');
  const plusManualNoteBtn = document.getElementById('plus-manual-note-btn');
  const plusVoiceNoteBtn = document.getElementById('plus-voice-note-btn');

  const themeLightBtn = document.getElementById('theme-light-btn');
  const themeDarkBtn = document.getElementById('theme-dark-btn');

  const backToChatBtn = document.getElementById('back-to-chat-btn');
  const backToBrowsingBtn = document.getElementById('back-to-browsing-btn');
  const backFromNoteBtn = document.getElementById('back-from-note-btn');

  const browsingViewEl = document.getElementById('browsing-view');
  const subjectDetailViewEl = document.getElementById('subject-detail-view');
  const subjectDetailTitleEl = document.getElementById('subject-detail-title');
  const subjectNotesListEl = document.getElementById('subject-notes-list');
  const notesListTitleEl = document.getElementById('notes-list-title');
  const recentNotesListEl = document.getElementById('recent-notes-list');

  const noteDetailViewEl = document.getElementById('note-detail-view');
  const noteDetailTitleEl = document.getElementById('note-detail-title');
  const noteDetailMetaEl = document.getElementById('note-detail-meta');
  const noteDetailContentEl = document.getElementById('note-detail-content');
  const deleteNoteBtn = document.getElementById('delete-note-btn');
  const editNoteBtn = document.getElementById('edit-note-btn');
  const noteEditForm = document.getElementById('note-edit-form');
  const noteEditTitleInput = document.getElementById('note-edit-title-input');
  const noteEditContentInput = document.getElementById('note-edit-content-input');
  const saveNoteEditBtn = document.getElementById('save-note-edit-btn');
  const cancelNoteEditBtn = document.getElementById('cancel-note-edit-btn');

  const addSubjectBtn = document.getElementById('add-subject-btn');
  const addSubjectModal = document.getElementById('add-subject-modal');
  const newSubjectInput = document.getElementById('new-subject-input');
  const saveSubjectBtn = document.getElementById('save-subject-btn');
  const cancelSubjectBtn = document.getElementById('cancel-subject-btn');

  const manualNoteModal = document.getElementById('manual-note-modal');
  const manualNoteTitleInput = document.getElementById('manual-note-title');
  const manualNoteSubjectSelect = document.getElementById('manual-note-subject');
  const manualNoteContentInput = document.getElementById('manual-note-content');
  const saveManualNoteBtn = document.getElementById('save-manual-note-btn');
  const cancelManualNoteBtn = document.getElementById('cancel-manual-note-btn');

  const commandModal = document.getElementById('command-modal');
  const commandStatusText = document.getElementById('command-status-text');
  const commandTranscriptText = document.getElementById('command-transcript-text');
  const commandFeedbackText = document.getElementById('command-feedback-text');
  const commandRetryBtn = document.getElementById('command-retry-btn');
  const commandCancelBtn = document.getElementById('command-cancel-btn');

  const dictationModal = document.getElementById('dictation-modal');
  const dictationSubjectName = document.getElementById('dictation-subject-name');
  const dictationTimerEl = document.getElementById('dictation-timer');
  const dictationTranscriptEl = document.getElementById('dictation-transcript');
  const finishNoteBtn = document.getElementById('finish-note-btn');
  const cancelDictationBtn = document.getElementById('cancel-dictation-btn');

  const toastEl = document.getElementById('toast');

  let currentlyViewedNote = null;
  let currentSubject = null;
  let dictationSession = null;

  const SUBJECT_ALIASES = {
    'biologia': ['bio','biologia','ciencias biologicas','biologicas'],
    'ciencias sociales': ['sociales','ciencias sociales','cs sociales','c sociales'],
    'informatica': ['info','informatica','computacion','computación'],
    'ingles': ['ingles','english']
  };

  async function resolveSubject(rawText) {
    const subjects = await window.AppDatabase.getAllSubjects();
    const text = normalize(rawText);
    let match = subjects.find(s => text.includes(normalize(s.name)));
    if (match) return match;
    for (const subject of subjects) {
      const key = normalize(subject.name);
      const aliases = SUBJECT_ALIASES[key] || [];
      if (aliases.some(alias => text.includes(normalize(alias)))) return subject;
    }
    return null;
  }

  // ---------- Utilidades ----------

  function normalize(text) {
    return window.AppDatabase.normalizeText(text).replace(/[.,;:!?¡¿"']/g, '');
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    setTimeout(() => toastEl.classList.add('hidden'), 2200);
  }

  function formatNoteMeta(note) {
    return `${note.subjectName} · ${note.date} ${note.time}`;
  }

  // ---------- Tema claro / oscuro ----------

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.body.classList.add('theme-dark');
      themeDarkBtn.classList.add('active');
      themeLightBtn.classList.remove('active');
    } else {
      document.body.classList.remove('theme-dark');
      themeLightBtn.classList.add('active');
      themeDarkBtn.classList.remove('active');
    }
    localStorage.setItem('apuntes-ia-theme', theme);
  }

  themeLightBtn.addEventListener('click', () => applyTheme('light'));
  themeDarkBtn.addEventListener('click', () => applyTheme('dark'));

  // ---------- Barra lateral de materias ----------

  async function renderSubjectsSidebar() {
    const [subjects, notes] = await Promise.all([
      window.AppDatabase.getAllSubjects(),
      window.AppDatabase.getAllNotes(),
    ]);

    subjectsListEl.innerHTML = '';
    manualNoteSubjectSelect.innerHTML = '';

    subjects.forEach((subject) => {
      const count = notes.filter((n) => n.subjectId === subject.id).length;

      const item = document.createElement('div');
      item.className = 'sidebar-subject-item';
      item.innerHTML = `<span class="subject-button-name">${escapeHtml(subject.name)}</span><span class="subject-button-end"><span class="sidebar-subject-count">${count}</span><span aria-hidden="true">›</span></span>`;
      item.addEventListener('click', () => openSubjectInNotesScreen(subject));
      subjectsListEl.appendChild(item);

      const option = document.createElement('option');
      option.value = subject.id;
      option.textContent = subject.name;
      manualNoteSubjectSelect.appendChild(option);
    });

    return subjects;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ---------- Chat ----------

  function appendUserBubble(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.innerHTML = `<p></p>`;
    bubble.querySelector('p').textContent = text;
    chatLogEl.appendChild(bubble);
    chatLogEl.scrollTop = chatLogEl.scrollHeight;
  }

  function appendAssistantBubble(text, notesToShow) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble assistant';

    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    bubble.appendChild(paragraph);

    if (notesToShow && notesToShow.length > 0) {
      const cardsWrapper = document.createElement('div');
      cardsWrapper.className = 'chat-result-cards';

      notesToShow.forEach((note) => {
        const card = document.createElement('div');
        card.className = 'chat-result-card';
        card.innerHTML = `
          <div class="chat-result-card-title"></div>
          <div class="chat-result-card-meta"></div>
        `;
        card.querySelector('.chat-result-card-title').textContent = note.title;
        card.querySelector('.chat-result-card-meta').textContent = formatNoteMeta(note);
        card.addEventListener('click', () => openNoteInNotesScreen(note));
        cardsWrapper.appendChild(card);
      });

      bubble.appendChild(cardsWrapper);
    }

    chatLogEl.appendChild(bubble);
    chatLogEl.scrollTop = chatLogEl.scrollHeight;
  }

  async function sendChatMessage(text) {
    appendUserBubble(text);
    chatTextInput.value = '';

    const subjects = await window.AppDatabase.getAllSubjects();
    const subjectNames = subjects.map((s) => s.name);

    let result;
    try {
      const response = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, subjectNames }),
      });
      result = response.ok ? await response.json() : null;
    } catch (error) {
      result = null;
    }

    if (!result || !result.intent) {
      appendAssistantBubble('No pude conectarme con el asistente en este momento. Intenta de nuevo en unos segundos.');
      return;
    }

    if (result.intent === 'buscar_apuntes') {
      const matchingNotes = await searchNotes(result, subjects);
      appendAssistantBubble(result.reply || 'Aquí tienes lo que encontré:', matchingNotes);
      return;
    }

    appendAssistantBubble(result.reply || 'Listo.');
  }

  async function searchNotes(result, subjects) {
    const allNotes = await window.AppDatabase.getAllNotes();
    let filtered = allNotes;

    if (result.subject) {
      const normalizedTarget = window.AppDatabase.normalizeText(result.subject);
      const subject = subjects.find((s) => s.normalizedName === normalizedTarget);
      if (subject) {
        filtered = filtered.filter((n) => n.subjectId === subject.id);
      }
    }

    if (result.desde) {
      const desdeDate = new Date(result.desde);
      filtered = filtered.filter((n) => new Date(n.createdAt) >= desdeDate);
    }

    if (result.hasta) {
      const hastaDate = new Date(result.hasta);
      hastaDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((n) => new Date(n.createdAt) <= hastaDate);
    }

    return filtered.slice(0, 10);
  }

  chatInputForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = chatTextInput.value.trim();
    if (!text) return;
    sendChatMessage(text);
  });

  chatMicBtn.addEventListener('click', async () => {
    if (!window.SpeechController.isSupported) {
      showToast('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
      return;
    }

    chatMicBtn.textContent = '🔴';
    await window.SpeechController.startCommandMode({
      onResult: ({ finalText, interimText }) => {
        chatTextInput.value = finalText || interimText;
        if (finalText) {
          chatMicBtn.textContent = '🎤';
          window.SpeechController.stop();
        }
      },
      onError: () => {
        chatMicBtn.textContent = '🎤';
        showToast('No se pudo escuchar el micrófono.');
      },
      onEnd: () => {
        chatMicBtn.textContent = '🎤';
      },
      onStart: () => {},
      onSilenceTimeout: () => {},
    });
  });

  // ---------- Menú "+" ----------

  plusMenuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    plusMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    plusMenu.classList.add('hidden');
  });

  plusManualNoteBtn.addEventListener('click', async () => {
    plusMenu.classList.add('hidden');
    await renderSubjectsSidebar();
    manualNoteTitleInput.value = '';
    manualNoteContentInput.value = '';
    manualNoteModal.classList.remove('hidden');
  });

  plusVoiceNoteBtn.addEventListener('click', () => {
    plusMenu.classList.add('hidden');
    openCommandModal();
  });

  cancelManualNoteBtn.addEventListener('click', () => {
    manualNoteModal.classList.add('hidden');
  });

  saveManualNoteBtn.addEventListener('click', async () => {
    const title = manualNoteTitleInput.value.trim();
    const content = manualNoteContentInput.value.trim();
    const subjectId = manualNoteSubjectSelect.value;
    const subjectName = manualNoteSubjectSelect.selectedOptions[0]?.textContent || '';

    if (!title || !content || !subjectId) {
      showToast('Completa el título, la materia y el contenido.');
      return;
    }

    try {
      await window.AppDatabase.createNote({
        subjectId,
        subjectName,
        title,
        content,
        durationSeconds: 0,
      });
      manualNoteModal.classList.add('hidden');
      showToast('Apunte guardado.');
      await renderSubjectsSidebar();
      appendAssistantBubble(`Guardé tu apunte "${title}" en ${subjectName}.`);
    } catch (error) {
      showToast('No se pudo guardar el apunte.');
    }
  });

  // ---------- Añadir materia ----------

  addSubjectBtn.addEventListener('click', () => {
    newSubjectInput.value = '';
    addSubjectModal.classList.remove('hidden');
    newSubjectInput.focus();
  });

  cancelSubjectBtn.addEventListener('click', () => {
    addSubjectModal.classList.add('hidden');
  });

  saveSubjectBtn.addEventListener('click', async () => {
    const name = newSubjectInput.value.trim();
    if (!name) {
      showToast('Escribe un nombre para la materia.');
      return;
    }
    try {
      await window.AppDatabase.createSubject(name);
      addSubjectModal.classList.add('hidden');
      showToast('Materia creada.');
      await renderSubjectsSidebar();
    } catch (error) {
      showToast('No se pudo crear la materia.');
    }
  });

  // ---------- Navegación a la pantalla de apuntes ----------

  function showNotesScreen() {
    chatShell.classList.add('hidden');
    notesShell.classList.remove('hidden');
  }

  function showChatScreen() {
    notesShell.classList.add('hidden');
    chatShell.classList.remove('hidden');
  }

  backToChatBtn.addEventListener('click', showChatScreen);

  function showInternalView(viewToShow) {
    [browsingViewEl, subjectDetailViewEl, noteDetailViewEl].forEach((v) => v.classList.add('hidden'));
    viewToShow.classList.remove('hidden');
  }

  backToBrowsingBtn.addEventListener('click', showChatScreen);
  backFromNoteBtn.addEventListener('click', () => { noteDetailViewEl.classList.add('hidden'); });

  function buildNoteCard(note) {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.innerHTML = `<div class="note-card-title"></div><div class="note-card-meta"></div>`;
    card.querySelector('.note-card-title').textContent = note.title;
    card.querySelector('.note-card-meta').textContent = formatNoteMeta(note);
    card.addEventListener('click', () => openNoteDetail(note));
    return card;
  }

  async function openSubjectInNotesScreen(subject) {
    currentSubject = subject;
    showNotesScreen();
    subjectDetailTitleEl.textContent = subject.name;
    const notes = await window.AppDatabase.getNotesBySubject(subject.id);

    subjectNotesListEl.innerHTML = '';
    if (notes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Esta materia todavía no tiene apuntes.';
      subjectNotesListEl.appendChild(empty);
    } else {
      notes.forEach((note) => subjectNotesListEl.appendChild(buildNoteCard(note)));
    }

    showInternalView(subjectDetailViewEl);
  }

  function openNoteInNotesScreen(note) {
    showNotesScreen();
    openNoteDetail(note);
  }

  function openNoteDetail(note) {
    currentlyViewedNote = note;
    noteDetailTitleEl.textContent = note.title;
    noteDetailMetaEl.textContent = formatNoteMeta(note);
    noteDetailContentEl.textContent = note.content;
    closeNoteEditForm();
    noteDetailViewEl.classList.remove('hidden');
  }

  deleteNoteBtn.addEventListener('click', async () => {
    if (!currentlyViewedNote) return;
    const confirmed = window.confirm('¿Eliminar este apunte? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    try {
      await window.AppDatabase.deleteNote(currentlyViewedNote.id);
      showToast('Apunte eliminado.');
      currentlyViewedNote = null;
      noteDetailViewEl.classList.add('hidden');
      await renderSubjectsSidebar();
      if (currentSubject) await openSubjectInNotesScreen(currentSubject);
    } catch (error) {
      showToast('No se pudo eliminar el apunte.');
    }
  });

  function openNoteEditForm() {
    if (!currentlyViewedNote) return;
    noteEditTitleInput.value = currentlyViewedNote.title;
    noteEditContentInput.value = currentlyViewedNote.content;
    noteEditForm.classList.remove('hidden');
    noteDetailContentEl.classList.add('hidden');
  }

  function closeNoteEditForm() {
    noteEditForm.classList.add('hidden');
    noteDetailContentEl.classList.remove('hidden');
  }

  editNoteBtn.addEventListener('click', openNoteEditForm);
  cancelNoteEditBtn.addEventListener('click', closeNoteEditForm);

  saveNoteEditBtn.addEventListener('click', async () => {
    if (!currentlyViewedNote) return;
    const newTitle = noteEditTitleInput.value.trim();
    const newContent = noteEditContentInput.value.trim();

    if (!newTitle || !newContent) {
      showToast('El título y el contenido no pueden quedar vacíos.');
      return;
    }

    try {
      const updated = await window.AppDatabase.updateNote(currentlyViewedNote.id, {
        title: newTitle,
        content: newContent,
      });
      currentlyViewedNote = updated;
      noteDetailTitleEl.textContent = updated.title;
      noteDetailContentEl.textContent = updated.content;
      closeNoteEditForm();
      showToast('Apunte actualizado.');
    } catch (error) {
      showToast('No se pudo guardar el apunte.');
    }
  });

  // ---------- Apunte por voz (comando + dictado) ----------

  function openCommandModal() {
    commandStatusText.textContent = 'Escuchando materia...';
    commandTranscriptText.textContent = '';
    commandFeedbackText.textContent = '';
    commandRetryBtn.classList.add('hidden');
    commandModal.classList.remove('hidden');
    startListeningForCommand();
  }

  function closeCommandModal() {
    commandModal.classList.add('hidden');
    window.SpeechController.stop();
  }

  async function startListeningForCommand() {
    commandStatusText.textContent = 'Escuchando materia...';
    commandFeedbackText.textContent = '';
    commandRetryBtn.classList.add('hidden');

    await window.SpeechController.startCommandMode({
      onResult: ({ finalText, interimText }) => {
        commandTranscriptText.textContent = finalText || interimText;
        if (finalText) {
          handleSubjectVoiceCommand(finalText);
        }
      },
      onError: (errorType) => handleSpeechError(errorType, 'command'),
      onEnd: () => {},
      onStart: () => {},
      onSilenceTimeout: () => {},
    });
  }

  function handleSpeechError(errorType, context) {
    let message = 'Ocurrió un error con el reconocimiento de voz.';
    if (errorType === 'not-supported') {
      message = 'Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.';
    } else if (errorType === 'permission-denied' || errorType === 'not-allowed') {
      message = 'No se concedió permiso para usar el micrófono.';
    } else if (errorType === 'no-speech') {
      message = 'No se detectó ninguna voz. Inténtalo de nuevo.';
    }

    if (context === 'command') {
      commandStatusText.textContent = message;
      commandRetryBtn.classList.remove('hidden');
    } else {
      showToast(message);
      endDictationSession(false);
    }
  }

  async function handleSubjectVoiceCommand(rawText) {
    const subject = await resolveSubject(rawText);

    if (!subject) {
      commandStatusText.textContent = 'No pude identificar la materia.';
      commandRetryBtn.classList.remove('hidden');
      return;
    }

    commandStatusText.textContent = `Materia identificada: ${subject.name}`;
    commandFeedbackText.textContent = 'Cambiando a modo dictado...';
    window.SpeechController.stop();

    setTimeout(() => {
      commandModal.classList.add('hidden');
      startDictationSession(subject);
    }, 900);
  }

  commandRetryBtn.addEventListener('click', () => startListeningForCommand());
  commandCancelBtn.addEventListener('click', () => closeCommandModal());

  function startDictationSession(subject) {
    dictationSession = {
      subjectId: subject.id,
      subjectName: subject.name,
      transcriptParts: [],
      startTime: Date.now(),
      timerInterval: null,
    };

    dictationSubjectName.textContent = subject.name;
    dictationTranscriptEl.textContent = '';
    dictationTimerEl.textContent = '00:00';
    dictationModal.classList.remove('hidden');

    dictationSession.timerInterval = setInterval(updateDictationTimer, 1000);

    window.SpeechController.startDictationMode({
      onResult: ({ finalText, interimText }) => {
        if (finalText) appendFinalText(finalText.trim());
        renderDictationTranscript(interimText);
      },
      onSilenceTimeout: () => finishNote(),
      onError: (errorType) => handleSpeechError(errorType, 'dictation'),
      onEnd: () => {},
      onStart: () => {},
    });
  }

  function appendFinalText(newFragment) {
    if (!newFragment) return;
    const normalizedNew = normalize(newFragment);
    const alreadyCaptured = dictationSession.transcriptParts.some((part) => {
      const normalizedPart = normalize(part);
      return normalizedPart === normalizedNew || normalizedPart.endsWith(normalizedNew);
    });
    if (alreadyCaptured) return;
    dictationSession.transcriptParts.push(newFragment);
  }

  function renderDictationTranscript(interimText) {
    const finalSoFar = dictationSession.transcriptParts.join(' ');
    const combined = interimText ? `${finalSoFar} ${interimText}` : finalSoFar;
    dictationTranscriptEl.textContent = combined.trim();
    dictationTranscriptEl.scrollTop = dictationTranscriptEl.scrollHeight;
  }

  function updateDictationTimer() {
    if (!dictationSession) return;
    const elapsedSeconds = Math.floor((Date.now() - dictationSession.startTime) / 1000);
    const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const seconds = String(elapsedSeconds % 60).padStart(2, '0');
    dictationTimerEl.textContent = `${minutes}:${seconds}`;
  }

  function generateProvisionalTitle(content) {
    const trimmed = content.trim();
    if (!trimmed) return 'Apunte sin título';

    const commonStarters = [
      'bueno', 'entonces', 'pues', 'osea', 'vale', 'a', 'ver', 'este',
      'eh', 'ehh', 'mmm', 'em', 'y', 'que', 'el', 'la', 'los', 'las',
      'un', 'una', 'de', 'del',
    ];
    let words = trimmed.split(/\s+/);
    while (words.length > 1 && commonStarters.includes(normalize(words[0]))) {
      words.shift();
    }
    if (words.length === 0) return 'Apunte sin título';

    const titleWords = words.slice(0, 8);
    let title = titleWords.join(' ').replace(/[.,;:]+$/, '');
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (words.length > 8) title += '…';
    return title;
  }

  async function enrichNoteWithAI(content, subjectName) {
    try {
      const response = await fetch('/.netlify/functions/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enrich_note', content, subjectName })
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (_) { return null; }
  }

  async function finishNote() {
    if (!dictationSession) return;

    const content = dictationSession.transcriptParts.join(' ').trim();
    const durationSeconds = Math.floor((Date.now() - dictationSession.startTime) / 1000);
    let title = generateProvisionalTitle(content);

    clearInterval(dictationSession.timerInterval);
    window.SpeechController.stop();
    dictationModal.classList.add('hidden');

    if (!content) {
      showToast('No se detectó contenido, el apunte no se guardó.');
      dictationSession = null;
      return;
    }

    try {
      const ai = await enrichNoteWithAI(content, dictationSession.subjectName);
      if (ai?.title) title = ai.title;
      await window.AppDatabase.createNote({
        subjectId: dictationSession.subjectId,
        subjectName: dictationSession.subjectName,
        title,
        content,
        durationSeconds,
      });
      showToast('Apunte guardado correctamente.');
      const aiMessage = ai?.summary ? ` Resumen IA: ${ai.summary}` : '';
      appendAssistantBubble(`Guardé tu apunte "${title}" en ${dictationSession.subjectName}.${aiMessage}`);
      await renderSubjectsSidebar();
    } catch (error) {
      showToast('Ocurrió un error al guardar el apunte.');
    }

    dictationSession = null;
  }

  function endDictationSession(shouldSave) {
    if (!dictationSession) return;
    if (shouldSave) {
      finishNote();
      return;
    }
    clearInterval(dictationSession.timerInterval);
    window.SpeechController.stop();
    dictationModal.classList.add('hidden');
    dictationSession = null;
  }

  finishNoteBtn.addEventListener('click', () => finishNote());
  cancelDictationBtn.addEventListener('click', () => endDictationSession(false));

  // ---------- Inicialización ----------

  async function init() {
    const savedTheme = localStorage.getItem('apuntes-ia-theme') || 'light';
    applyTheme(savedTheme);

    try {
      await window.AppDatabase.openDatabase();
    } catch (error) {
      showToast('No se pudo iniciar la base de datos local.');
      return;
    }

    const speechSupported = window.SpeechController.checkSupport();
    if (!speechSupported) {
      showToast('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
    }

    await renderSubjectsSidebar();

    notesListTitleEl.textContent = 'Apuntes';
    recentNotesListEl.innerHTML = '';
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Selecciona una materia o busca apuntes desde el chat.';
    recentNotesListEl.appendChild(empty);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
