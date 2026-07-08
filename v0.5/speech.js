/**
 * speech.js
 * Controla el reconocimiento de voz mediante la Web Speech API.
 * Ofrece dos modos de uso:
 *  - Modo "comando": escucha una frase corta (crear apunte en X).
 *  - Modo "dictado": escucha de forma continua y avisa tras un silencio prolongado.
 */

const SpeechController = (() => {
  const SILENCE_TIMEOUT_MS = 8000;

  let recognition = null;
  let isSupported = true;
  let silenceTimer = null;
  let manuallyStopped = false;
  let currentMode = null; // 'command' | 'dictation'

  let callbacks = {
    onResult: () => {},
    onSilenceTimeout: () => {},
    onError: () => {},
    onEnd: () => {},
    onStart: () => {},
  };

  /**
   * Comprueba si el navegador soporta la Web Speech API y crea la instancia.
   * @returns {boolean}
   */
  function checkSupport() {
    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) {
      isSupported = false;
      return false;
    }
    isSupported = true;
    recognition = new SpeechRecognitionImpl();
    recognition.lang = 'es-ES';
    recognition.interimResults = true;
    recognition.continuous = true;
    attachRecognitionHandlers();
    return true;
  }

  /**
   * Une los manejadores de eventos del objeto recognition.
   */
  function attachRecognitionHandlers() {
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcriptPiece;
        } else {
          interimText += transcriptPiece;
        }
      }

      resetSilenceTimer();
      callbacks.onResult({ finalText, interimText });
    };

    recognition.onerror = (event) => {
      callbacks.onError(event.error);
    };

    recognition.onend = () => {
      clearSilenceTimer();
      callbacks.onEnd();

      // Si el reconocimiento terminó solo (no lo detuvo el usuario) y seguimos
      // en modo dictado, se reinicia para evitar cortes inesperados del navegador.
      if (!manuallyStopped && currentMode === 'dictation') {
        try {
          recognition.start();
          resetSilenceTimer();
        } catch (error) {
          // Si falla el reinicio (por ejemplo ya está activo), se ignora en silencio.
        }
      }
    };
  }

  /**
   * Reinicia el temporizador de silencio para el modo dictado.
   */
  function resetSilenceTimer() {
    if (currentMode !== 'dictation') return;
    clearSilenceTimer();
    silenceTimer = setTimeout(() => {
      callbacks.onSilenceTimeout();
    }, SILENCE_TIMEOUT_MS);
  }

  function clearSilenceTimer() {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  }

  /**
   * Solicita permiso de micrófono explícitamente antes de iniciar el reconocimiento,
   * para poder mostrar un mensaje claro si el usuario lo rechaza.
   * @returns {Promise<boolean>}
   */
  async function requestMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Inicia el reconocimiento en modo comando (una sola frase corta).
   * @param {Object} handlers
   */
  async function startCommandMode(handlers) {
    callbacks = { ...callbacks, ...handlers };

    if (!isSupported) {
      callbacks.onError('not-supported');
      return;
    }

    const granted = await requestMicrophonePermission();
    if (!granted) {
      callbacks.onError('permission-denied');
      return;
    }

    currentMode = 'command';
    manuallyStopped = false;
    recognition.continuous = false;

    try {
      recognition.start();
      callbacks.onStart();
    } catch (error) {
      callbacks.onError('start-failed');
    }
  }

  /**
   * Inicia el reconocimiento en modo dictado continuo.
   * @param {Object} handlers
   */
  function startDictationMode(handlers) {
    callbacks = { ...callbacks, ...handlers };

    if (!isSupported) {
      callbacks.onError('not-supported');
      return;
    }

    currentMode = 'dictation';
    manuallyStopped = false;
    recognition.continuous = true;

    try {
      recognition.start();
      resetSilenceTimer();
      callbacks.onStart();
    } catch (error) {
      callbacks.onError('start-failed');
    }
  }

  /**
   * Detiene el reconocimiento de forma intencional (el usuario finalizó o canceló).
   */
  function stop() {
    manuallyStopped = true;
    clearSilenceTimer();
    currentMode = null;
    if (recognition) {
      try {
        recognition.stop();
      } catch (error) {
        // Se ignora si ya estaba detenido.
      }
    }
  }

  return {
    checkSupport,
    startCommandMode,
    startDictationMode,
    stop,
    get isSupported() {
      return isSupported;
    },
  };
})();

window.SpeechController = SpeechController;
