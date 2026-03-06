export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();

  if (/^[0-9A-Za-z_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.replace(/^www\./, '');

    if (hostname === 'youtu.be') {
      return parsed.pathname.split('/').filter(Boolean)[0] ?? null;
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }

      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
        return parts[1] ?? null;
      }
    }
  } catch {
    // Fall through to regex parsing.
  }

  const match = trimmed.match(/([0-9A-Za-z_-]{11})/);
  return match?.[1] ?? null;
}
