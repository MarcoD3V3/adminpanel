export type PasswordValidationResult = {
  valid: boolean;
  score: number;
  strength: "muy_debil" | "debil" | "media" | "fuerte" | "muy_fuerte";
  errors: string[];
  hints: string[];
};

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

const SPECIAL_CHARS = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

const COMMON_PASSWORDS = new Set(
  [
    "password",
    "password1",
    "password123",
    "123456",
    "12345678",
    "123456789",
    "qwerty",
    "qwerty123",
    "admin",
    "admin123",
    "letmein",
    "welcome",
    "minecraft",
    "launcher",
    "contraseña",
    "contrasena",
    "iloveyou",
    "monkey",
    "dragon",
    "master",
    "sunshine",
    "princess",
    "football",
    "baseball",
    "trustno1",
    "000000",
    "111111",
    "abc123",
    "passw0rd",
    "changeme",
    "secret",
    "default",
  ].map((p) => p.toLowerCase())
);

const SEQUENCES = [
  "0123456789",
  "9876543210",
  "abcdefghijklmnopqrstuvwxyz",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
];

function hasSequentialRun(value: string, runLength = 4): boolean {
  const lower = value.toLowerCase();
  for (const seq of SEQUENCES) {
    for (let i = 0; i <= seq.length - runLength; i++) {
      const chunk = seq.slice(i, i + runLength);
      if (lower.includes(chunk)) return true;
    }
  }
  return false;
}

function hasRepeatingRun(value: string, runLength = 4): boolean {
  return /(.)\1{3,}/.test(value);
}

function entropyBits(password: string): number {
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/\d/.test(password)) pool += 10;
  if (SPECIAL_CHARS.test(password)) pool += 32;
  if (pool === 0) return 0;
  return password.length * Math.log2(pool);
}

export function validatePassword(
  password: string,
  opts?: { username?: string; displayName?: string }
): PasswordValidationResult {
  const errors: string[] = [];
  const hints: string[] = [];
  let score = 0;

  const trimmed = password.trim();
  if (password !== trimmed) {
    errors.push("No uses espacios al inicio o al final");
  }

  if (!password || password.length < MIN_LENGTH) {
    errors.push(`Mínimo ${MIN_LENGTH} caracteres`);
  } else {
    score += Math.min(30, password.length * 2);
  }

  if (password.length > MAX_LENGTH) {
    errors.push(`Máximo ${MAX_LENGTH} caracteres`);
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Incluye al menos una minúscula");
  } else {
    score += 12;
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Incluye al menos una mayúscula");
  } else {
    score += 12;
  }

  if (!/\d/.test(password)) {
    errors.push("Incluye al menos un número");
  } else {
    score += 12;
  }

  if (!SPECIAL_CHARS.test(password)) {
    errors.push("Incluye al menos un símbolo (!@#$%…)");
  } else {
    score += 14;
  }

  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    errors.push("Contraseña demasiado común");
    score -= 40;
  }

  const username = opts?.username?.trim().toLowerCase();
  if (username && username.length >= 3 && lower.includes(username)) {
    errors.push("No incluyas tu nombre de usuario");
    score -= 20;
  }

  const displayName = opts?.displayName?.trim().toLowerCase();
  if (displayName && displayName.length >= 3 && lower.includes(displayName)) {
    errors.push("No incluyas tu nombre visible");
    score -= 15;
  }

  if (hasSequentialRun(password)) {
    errors.push("Evita secuencias obvias (1234, abcd, qwerty)");
    score -= 15;
  }

  if (hasRepeatingRun(password)) {
    errors.push("Evita repetir el mismo carácter muchas veces");
    score -= 10;
  }

  if (/^(.)\1+$/.test(password)) {
    errors.push("No uses un solo carácter repetido");
    score -= 30;
  }

  const uniqueChars = new Set(password).size;
  if (password.length >= MIN_LENGTH && uniqueChars < 6) {
    errors.push("Usa más caracteres distintos");
    score -= 10;
  } else if (uniqueChars >= 8) {
    score += 10;
  }

  const bits = entropyBits(password);
  if (bits >= 60) score += 10;
  if (bits >= 80) score += 10;

  score = Math.max(0, Math.min(100, score));

  const strength: PasswordValidationResult["strength"] =
    score >= 85
      ? "muy_fuerte"
      : score >= 65
        ? "fuerte"
        : score >= 45
          ? "media"
          : score >= 25
            ? "debil"
            : "muy_debil";

  if (errors.length === 0 && strength === "fuerte") {
    hints.push("Buena contraseña. Guárdala en un gestor seguro.");
  }
  if (errors.length === 0 && strength === "muy_fuerte") {
    hints.push("Excelente entropía.");
  }

  return {
    valid: errors.length === 0,
    score,
    strength,
    errors,
    hints,
  };
}

export function passwordPolicySummary(): string {
  return `Mín. ${MIN_LENGTH} caracteres, mayúscula, minúscula, número y símbolo`;
}
