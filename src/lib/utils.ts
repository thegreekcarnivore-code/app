import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Strip accents from Greek text (for uppercase rendering per Greek typography rules) */
const greekAccentMap: Record<string, string> = {
  "ά": "α", "έ": "ε", "ή": "η", "ί": "ι", "ό": "ο", "ύ": "υ", "ώ": "ω",
  "Ά": "Α", "Έ": "Ε", "Ή": "Η", "Ί": "Ι", "Ό": "Ο", "Ύ": "Υ", "Ώ": "Ω",
  "ΐ": "ι", "ΰ": "υ", "ϊ": "ι", "ϋ": "υ", "Ϊ": "Ι", "Ϋ": "Υ",
};

export function stripGreekAccents(text: string): string {
  return text.replace(/[άέήίόύώΆΈΉΊΌΎΏΐΰϊϋΪΫ]/g, (ch) => greekAccentMap[ch] || ch);
}
