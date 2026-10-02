import type { AcademicEvent, Category } from "./types.ts";

export const CATEGORIES: { id: Category; label: string; description: string }[] = [
  { id: "no-classes", label: "No classes", description: "Breaks and holidays" },
  { id: "exams", label: "Final exams", description: "Final exam periods" },
  { id: "term", label: "Term dates", description: "Classes begin, resume and end" },
  { id: "deadline", label: "Deadlines", description: "Add/drop, withdrawal and other deadlines" },
  { id: "registration", label: "Registration", description: "Registration opens and closes" },
  { id: "other", label: "Other", description: "Observances, make-up days and notes" },
];

export function categoryLabel(category: Category): string {
  return CATEGORIES.find((c) => c.id === category)?.label ?? category;
}

/**
 * "Key dates": what most families want on their personal calendar.
 * Used for the smaller ICS feed.
 */
export const KEY_CATEGORIES: readonly Category[] = ["no-classes", "term", "exams"];

export function isKeyDate(event: AcademicEvent): boolean {
  return KEY_CATEGORIES.includes(event.category);
}
