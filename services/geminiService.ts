/**
 * @file geminiService.ts
 * @description Handles interaction with Google's Gemini API to generate game content.
 * 
 * AI CONTEXT:
 * - PURPOSE: Generates the word list, hints, and difficulties dynamically.
 * - FALLBACK: Contains a `GIANT_WORD_LIST` constant used if no API Key is present or if the API call fails.
 * - PROMPT: Engineered to return JSON output specifically formatted for `WordData` (Word + 3 Hints).
 */

import { GoogleGenAI, Type } from "@google/genai";
import { WordData } from "../types";

// --- FALLBACK DATA ---
// Used when process.env.API_KEY is missing.
// Contains hardcoded words with 3 progressive hints each.
const GIANT_WORD_LIST: WordData[] = [
  { word: "BANANA", hints: ["I am a fruit", "I am yellow and curved", "Monkeys love to eat me"], difficulty: "easy" },
  { word: "ELEPHANT", hints: ["I am a very large land animal", "I have a long trunk", "I have big floppy ears"], difficulty: "easy" },
  { word: "GALAXY", hints: ["I contain billions of stars", "The Milky Way is one of me", "I am held together by gravity"], difficulty: "medium" },
  { word: "ORCHESTRA", hints: ["I am a large group of musicians", "I have a conductor", "I play symphonies"], difficulty: "hard" },
  { word: "VOLCANO", hints: ["I am a mountain that opens downward", "I can erupt with lava", "I often have a crater"], difficulty: "medium" },
  { word: "PIZZA", hints: ["I am a popular Italian dish", "I am round and sliced", "I have cheese and tomato sauce"], difficulty: "easy" },
  { word: "ASTRONAUT", hints: ["I travel to space", "I wear a special suit", "I work on the ISS"], difficulty: "medium" },
  { word: "LIBRARY", hints: ["I am a place with many books", "You must be quiet inside me", "You can borrow things from me"], difficulty: "easy" },
  { word: "DIAMOND", hints: ["I am a very hard gemstone", "I am made of compressed carbon", "I am a girl's best friend"], difficulty: "medium" },
  { word: "PYRAMID", hints: ["I am a triangular structure", "I am famous in Egypt", "I served as a tomb for pharaohs"], difficulty: "medium" },
  { word: "TORNADO", hints: ["I am a violently rotating column of air", "I am often called a twister", "I occur during severe thunderstorms"], difficulty: "medium" },
  { word: "KANGAROO", hints: ["I am an animal from Australia", "I hop to move around", "I carry my baby in a pouch"], difficulty: "easy" },
  { word: "CHOCOLATE", hints: ["I am a sweet treat", "I am made from cocoa beans", "I come in dark, milk, and white varieties"], difficulty: "easy" },
  { word: "OCTOPUS", hints: ["I live in the ocean", "I have eight arms", "I can squirt ink"], difficulty: "medium" },
  { word: "RAINBOW", hints: ["I appear after rain", "I have seven colors", "I am an optical illusion in the sky"], difficulty: "easy" },
  { word: "HELICOPTER", hints: ["I am an aircraft", "I have spinning rotors on top", "I can hover in place"], difficulty: "medium" },
  { word: "SNOWMAN", hints: ["I am made of frozen water", "I have a carrot nose", "I melt in the sun"], difficulty: "easy" },
  { word: "TELESCOPE", hints: ["I help you see far away", "Astronomers use me", "I use lenses or mirrors"], difficulty: "medium" },
  { word: "VAMPIRE", hints: ["I am a mythical creature", "I drink blood", "I dislike garlic and sunlight"], difficulty: "easy" },
  { word: "SKELETON", hints: ["I am inside your body", "I am made of bones", "I protect your organs"], difficulty: "easy" },
  { word: "SUBMARINE", hints: ["I travel underwater", "I am used by the navy", "I use sonar to navigate"], difficulty: "medium" },
  { word: "JUNGLE", hints: ["I am a dense forest", "I have a tropical climate", "Many wild animals live here"], difficulty: "medium" },
  { word: "BUTTERFLY", hints: ["I start as a caterpillar", "I have colorful wings", "I drink nectar from flowers"], difficulty: "easy" },
  { word: "ROBOT", hints: ["I am a machine", "I can be programmed", "I might take over the world someday"], difficulty: "medium" },
  { word: "ISLAND", hints: ["I am land surrounded by water", "Hawaii is a famous example", "I can be tropical or rocky"], difficulty: "easy" },
  { word: "DENTIST", hints: ["I am a doctor for teeth", "I fill cavities", "I tell you to floss"], difficulty: "medium" },
  { word: "PENGUIN", hints: ["I am a bird that cannot fly", "I live in the southern hemisphere", "I waddle and swim"], difficulty: "easy" },
  { word: "FIREWORKS", hints: ["I am used for celebrations", "I explode with light and noise", "I am common on New Year's Eve"], difficulty: "medium" },
  { word: "SUNFLOWER", hints: ["I am a tall yellow flower", "I produce edible seeds", "I turn my head to follow the sun"], difficulty: "easy" },
  { word: "COMPASS", hints: ["I am a navigation tool", "I always point North", "I use magnetism"], difficulty: "medium" },
];

export const generateWords = async (count: number): Promise<WordData[]> => {
  // 1. Fallback if no API Key
  if (!process.env.API_KEY) {
    console.warn("No API_KEY found, using fallback words.");
    return [...GIANT_WORD_LIST].sort(() => 0.5 - Math.random()).slice(0, count);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // 2. Gemini API Call
    // Asking for strict JSON array schema
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate ${count} random words for a guessing game. 
      Mix difficulties (easy, medium, hard). 
      Ensure words are single words, uppercase, and between 4-10 letters.
      Instead of a single category, provide 3 short, progressive hints (clues) for each word.
      Hint 1: Vague. Hint 2: More specific. Hint 3: Giveaway.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING, description: "The word to guess (uppercase)" },
              hints: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "List of 3 hints ranging from vague to specific"
              },
              difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] }
            },
            required: ["word", "hints", "difficulty"]
          }
        }
      }
    });

    if (response.text) {
      const words = JSON.parse(response.text) as WordData[];
      return words;
    }
    // Fallback if parsing fails or response empty
    return [...GIANT_WORD_LIST].sort(() => 0.5 - Math.random()).slice(0, count);
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback on error
    return [...GIANT_WORD_LIST].sort(() => 0.5 - Math.random()).slice(0, count);
  }
};