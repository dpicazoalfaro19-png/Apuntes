/**
 * chat.js
 *
 * Función intermedia que recibe un mensaje de chat (texto escrito o
 * transcrito por voz), se lo manda a Gemini junto con la lista de materias,
 * y regresa una respuesta estructurada que la app puede usar directamente.
 *
 * La clave de Gemini se lee de una variable de entorno (GEMINI_API_KEY),
 * configurada en Netlify. Nunca se escribe aquí en el código.
 */

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido.' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Falta configurar GEMINI_API_KEY en Netlify.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Cuerpo de la petición inválido.' }) };
  }

  const { message, subjectNames, action, content, subjectName } = body;

  if (action === 'enrich_note') {
    if (!content) return { statusCode: 400, body: JSON.stringify({ error: 'Falta content.' }) };
    const prompt = `Analiza este apunte de ${subjectName || 'una materia'}. Devuelve SOLO JSON válido con title (máximo 8 palabras), summary (máximo 30 palabras) y tags (array de máximo 4 conceptos). No inventes información. Apunte: ${content}`;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({contents:[{parts:[{text:prompt}]}]}) });
      if (!r.ok) return { statusCode: 502, body: JSON.stringify({ error:'IA no disponible.' }) };
      const d=await r.json(); const raw=d.candidates?.[0]?.content?.parts?.[0]?.text||'';
      return { statusCode:200, body:JSON.stringify(JSON.parse(raw.replace(/```json|```/g,'').trim())) };
    } catch(e) { return { statusCode:502, body:JSON.stringify({error:'IA no disponible.'}) }; }
  }

  if (!message || !Array.isArray(subjectNames)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltan datos: message o subjectNames.' }) };
  }

  const today = new Date().toISOString().split('T')[0];

  const systemPrompt = `Eres el asistente conversacional de "Mis Apuntes IA", una app de apuntes de estudio.
Materias disponibles del usuario: ${subjectNames.join(', ') || '(no tiene materias aún)'}.
Hoy es ${today}.

El usuario te escribe un mensaje. Responde SOLO con un JSON válido, sin explicaciones, sin markdown, sin backticks.

Formato de respuesta (siempre estos 5 campos):
{
  "intent": "buscar_apuntes" | "crear_apunte_sugerencia" | "chat",
  "subject": "NOMBRE_EXACTO_DE_LA_LISTA_O_NULL",
  "desde": "YYYY-MM-DD_O_NULL",
  "hasta": "YYYY-MM-DD_O_NULL",
  "reply": "Una respuesta breve, natural y amigable en español para mostrar en el chat"
}

Reglas:
- Usa "buscar_apuntes" si el usuario quiere ver, buscar o encontrar apuntes (por materia y/o fecha).
- Usa "crear_apunte_sugerencia" si el usuario quiere crear un apunte nuevo (dile en "reply" que use el botón "+" junto al chat para dictarlo o escribirlo).
- Usa "chat" para saludos, preguntas generales o cualquier otra cosa. Responde de forma útil y breve, como un asistente de estudio.
- "subject" debe coincidir EXACTO con un nombre de la lista de materias, o null si no aplica.
- Si el usuario menciona un rango relativo ("esta semana", "el mes pasado"), calcula las fechas exactas usando la fecha de hoy.
- "reply" nunca debe ir vacío.

Mensaje del usuario: "${message}"`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Gemini no respondió bien.', details: errorText }) };
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanedText = rawText.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (error) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Gemini no devolvió un JSON válido.', raw: rawText }) };
    }

    return { statusCode: 200, body: JSON.stringify(parsed) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Error al conectar con Gemini.', details: error.message }) };
  }
};
