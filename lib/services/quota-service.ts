import { updateStore } from './local-store';

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

  const today = todayKey();
  let allowed = true;
  let countAfterIncrement = 0;
  let shouldAlert = false;

  await updateStore((store) => {
    const currentCount = store.usageByDate[today] ?? 0;

    if (currentCount >= DAILY_REPORT_LIMIT) {
      allowed = false;
      countAfterIncrement = currentCount;
      return store;
    }

    countAfterIncrement = currentCount + 1;
    const alertThreshold = Math.max(
      1,
      Math.floor((DAILY_REPORT_LIMIT * ALERT_THRESHOLD_PERCENT) / 100),
    );
    shouldAlert = countAfterIncrement >= alertThreshold && !store.alertsSentByDate[today];

    return {
      ...store,
      usageByDate: {
        ...store.usageByDate,
        [today]: countAfterIncrement,
      },
      alertsSentByDate: shouldAlert
        ? {
            ...store.alertsSentByDate,
            [today]: true,
          }
        : store.alertsSentByDate,
    };
  });

  if (!allowed) {
    return {
      allowed: false,
      message: "Today's report limit has been reached. Try again tomorrow.",
    };
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
