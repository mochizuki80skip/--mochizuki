import { GoogleGenAI } from "@google/genai";

export const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const GEMINI_MODEL =
  process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
