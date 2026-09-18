const STORAGE_KEY = "smart-gallery:shoots";

export function readShoots(): Record<string, {
  shootId: string;
  fileUrls: string[];
  email?: string | null;
  createdAt: number;
  aiResults?: Array<{
    url: string;
    score: number | null;
    status: string;
    error?: string;
  }>;
  public?: boolean;
}> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, {
      shootId: string;
      fileUrls: string[];
      email?: string | null;
      createdAt: number;
      aiResults?: Array<{
        url: string;
        score: number | null;
        status: string;
        error?: string;
      }>;
    }>;
  } catch {
    return {};
  }
}

function writeShoots(shoots: Record<string, {
  shootId: string;
  fileUrls: string[];
  email?: string | null;
  createdAt: number;
  aiResults?: Array<{
    url: string;
    score: number | null;
    status: string;
    error?: string;
  }>;
}>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shoots));
  } catch {
    // localStorage может быть переполнен или заблокирован
  }
}

export function saveShoot(record: {
  shootId: string;
  fileUrls: string[];
  email?: string | null;
  createdAt: number;
  aiResults?: Array<{
    url: string;
    score: number | null;
    status: string;
    error?: string;
  }>;
  public?: boolean;
}) {
  const shoots = readShoots();
  shoots[record.shootId] = record;
  writeShoots(shoots);
}

export function removeShoot(shootId: string) {
  const shoots = readShoots();
  delete shoots[shootId];
  writeShoots(shoots);
}
