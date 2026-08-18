// Translated labels for the small, closed sets of enum-like values that
// appear on every exercise (level, equipment, category, force, mechanic,
// muscle names). These come from the free exercise database and are only
// ever one of a fixed handful of English strings, so they're translated
// once here as lookup tables instead of per-exercise.

export type ExerciseLocale = "en" | "ru" | "pl";

type Translations = Record<string, { ru: string; pl: string }>;

export const LEVEL_TRANSLATIONS: Translations = {
  beginner: { ru: "Начинающий", pl: "Początkujący" },
  intermediate: { ru: "Средний", pl: "Średniozaawansowany" },
  expert: { ru: "Продвинутый", pl: "Zaawansowany" },
};

export const EQUIPMENT_TRANSLATIONS: Translations = {
  "body only": { ru: "Только вес тела", pl: "Tylko masa ciała" },
  machine: { ru: "Тренажёр", pl: "Maszyna" },
  other: { ru: "Другое", pl: "Inne" },
  "foam roll": { ru: "Роллер", pl: "Wałek do masażu" },
  kettlebells: { ru: "Гири", pl: "Kettlebell" },
  dumbbell: { ru: "Гантели", pl: "Hantle" },
  cable: { ru: "Блок (кроссовер)", pl: "Wyciąg (linka)" },
  barbell: { ru: "Штанга", pl: "Sztanga" },
  bands: { ru: "Резиновые ленты", pl: "Gumy oporowe" },
  "medicine ball": { ru: "Медбол", pl: "Piłka lekarska" },
  "exercise ball": { ru: "Фитбол", pl: "Piłka gimnastyczna" },
  "e-z curl bar": { ru: "EZ-гриф", pl: "Drążek EZ" },
};

export const CATEGORY_TRANSLATIONS: Translations = {
  strength: { ru: "Силовая", pl: "Siłowe" },
  stretching: { ru: "Растяжка", pl: "Rozciąganie" },
  plyometrics: { ru: "Плиометрика", pl: "Plyometria" },
  strongman: { ru: "Strongman", pl: "Strongman" },
  powerlifting: { ru: "Пауэрлифтинг", pl: "Trójbój siłowy" },
  cardio: { ru: "Кардио", pl: "Cardio" },
  "olympic weightlifting": { ru: "Тяжёлая атлетика", pl: "Podnoszenie ciężarów" },
};

export const FORCE_TRANSLATIONS: Translations = {
  pull: { ru: "Тяга", pl: "Ciągnięcie" },
  push: { ru: "Жим", pl: "Pchanie" },
  static: { ru: "Статика", pl: "Statyczne" },
};

export const MECHANIC_TRANSLATIONS: Translations = {
  compound: { ru: "Многосуставное", pl: "Wielostawowe" },
  isolation: { ru: "Изолирующее", pl: "Izolowane" },
};

export const MUSCLE_TRANSLATIONS: Translations = {
  abdominals: { ru: "Пресс", pl: "Brzuch" },
  hamstrings: { ru: "Бицепс бедра", pl: "Dwugłowy uda" },
  calves: { ru: "Икры", pl: "Łydki" },
  shoulders: { ru: "Плечи", pl: "Barki" },
  adductors: { ru: "Приводящие мышцы бедра", pl: "Przywodziciele" },
  glutes: { ru: "Ягодицы", pl: "Pośladki" },
  quadriceps: { ru: "Квадрицепс", pl: "Czworogłowy uda" },
  biceps: { ru: "Бицепс", pl: "Biceps" },
  forearms: { ru: "Предплечья", pl: "Przedramiona" },
  abductors: { ru: "Отводящие мышцы бедра", pl: "Odwodziciele" },
  triceps: { ru: "Трицепс", pl: "Triceps" },
  chest: { ru: "Грудь", pl: "Klatka piersiowa" },
  "lower back": { ru: "Поясница", pl: "Dolna część pleców" },
  traps: { ru: "Трапеции", pl: "Czworoboczne" },
  "middle back": { ru: "Середина спины", pl: "Środkowa część pleców" },
  lats: { ru: "Широчайшие", pl: "Najszersze grzbietu" },
  neck: { ru: "Шея", pl: "Szyja" },
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function lookup(dict: Translations, value: string, locale: ExerciseLocale): string {
  if (locale === "en") return capitalize(value);
  const entry = dict[value.toLowerCase()];
  if (!entry) return capitalize(value);
  return locale === "ru" ? entry.ru : entry.pl;
}

export const translateLevel = (value: string, locale: ExerciseLocale) =>
  lookup(LEVEL_TRANSLATIONS, value, locale);

export const translateEquipment = (value: string, locale: ExerciseLocale) =>
  lookup(EQUIPMENT_TRANSLATIONS, value, locale);

export const translateCategory = (value: string, locale: ExerciseLocale) =>
  lookup(CATEGORY_TRANSLATIONS, value, locale);

export const translateForce = (value: string, locale: ExerciseLocale) =>
  lookup(FORCE_TRANSLATIONS, value, locale);

export const translateMechanic = (value: string, locale: ExerciseLocale) =>
  lookup(MECHANIC_TRANSLATIONS, value, locale);

export const translateMuscle = (value: string, locale: ExerciseLocale) =>
  lookup(MUSCLE_TRANSLATIONS, value, locale);
