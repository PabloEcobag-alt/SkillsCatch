import { supabase } from './supabaseClient'; 

let isRequestPending = false;

// SECURITY: Input Sanitization function
const sanitizeInput = (text) => {
  if (!text) return "";
  return text
    .replace(/<[^>]*>?/gm, '') // Strips out HTML tags (XSS prevention)
    .replace(/[^\w\s,.?!\-+#&]/gi, '') // Keeps alphanumeric + basic punctuation/IT symbols
    .trim();
};

export const analyzeResumeWithAI = async (textData, mode = "SKILLS_ONLY", targetJob = "") => {
  if (isRequestPending) {
    console.warn("⏳ API is already processing a request. Blocking duplicate call.");
    throw new Error("REQUEST_IN_PROGRESS");
  }

  isRequestPending = true;

  try {
    // Sanitize inputs before sending to backend
    const cleanTextData = sanitizeInput(textData);
    const cleanTargetJob = sanitizeInput(targetJob);

    // Securely call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('generate-roadmap', {
      body: { 
        textData: cleanTextData, 
        mode: mode, 
        targetJob: cleanTargetJob 
      }
    });

    if (error) {
      console.error("Edge Function Error:", error);
      throw new Error("AI_PROCESSING_FAILED");
    }

    if (data?.error) {
      console.error("AI Service Error:", data.error, data.message);
      throw new Error(data.error);
    }

    return data;

  } catch (error) {
    console.error("Client Service Error:", error);
    if (error.message === "REQUEST_IN_PROGRESS" || error.message === "RATE_LIMIT_EXCEEDED" || error.message === "INVALID_INPUT") {
      throw error;
    }
    throw new Error("AI_PROCESSING_FAILED");
  } finally {
    isRequestPending = false;
  }
};