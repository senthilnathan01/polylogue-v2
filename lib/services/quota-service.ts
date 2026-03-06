import { getResearchSystem } from '@/lib/research-system';

const DAILY_REPORT_LIMIT = Number(process.env.DAILY_REPORT_LIMIT ?? 25);
const ALERT_THRESHOLD_PERCENT = Number(process.env.ALERT_THRESHOLD_PERCENT ?? 60);
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function checkAndIncrement(): Promise<{ allowed: boolean; message: string }> {
  if (!Number.isFinite(DAILY_REPORT_LIMIT) || DAILY_REPORT_LIMIT <= 0) {
    return { allowed: true, message: 'ok' };
  }

  const usageRepository = getResearchSystem().repositories.usage;
  const today = todayKey();
  const currentCount = await usageRepository.getDailyCount(today);

  if (currentCount >= DAILY_REPORT_LIMIT) {
    return {
      allowed: false,
      message: "Today's report limit has been reached. Try again tomorrow.",
    };
  }

  const countAfterIncrement = await usageRepository.incrementDailyCount(today);
  const alertThreshold = Math.max(1, Math.floor((DAILY_REPORT_LIMIT * ALERT_THRESHOLD_PERCENT) / 100));
  const shouldAlert =
    countAfterIncrement >= alertThreshold && !(await usageRepository.hasSentAlert(today));

  if (shouldAlert) {
    await usageRepository.markAlertSent(today);
  }

  if (shouldAlert) {
    await sendAlert(countAfterIncrement);
  }

  return { allowed: true, message: 'ok' };
}

async function sendAlert(count: number): Promise<void> {
  if (!ALERT_WEBHOOK_URL) {
    return;
  }

  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `polylogue-v2 has used ${count}/${DAILY_REPORT_LIMIT} reports today.`,
      }),
    });
  } catch (error) {
    console.error('Error sending usage alert:', error);
  }
}
