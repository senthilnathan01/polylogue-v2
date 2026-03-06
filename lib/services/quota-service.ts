import { supabase } from '../supabase';
import { format } from 'date-fns';

const DAILY_REPORT_LIMIT = 70;
const ALERT_THRESHOLD_PERCENT = 50;
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

export async function checkAndIncrement(): Promise<{ allowed: boolean; message: string }> {
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const { data: usage, error } = await supabase
    .from('daily_usage')
    .select('*')
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    console.error('Error checking daily usage:', error);
    return { allowed: false, message: 'Internal server error' };
  }

  const count = usage ? usage.report_count : 0;
  
  if (count >= DAILY_REPORT_LIMIT) {
    return { allowed: false, message: "We've hit our daily analysis limit. Come back tomorrow 🙏" };
  }

  // Increment usage
  const { error: updateError } = await supabase
    .from('daily_usage')
    .upsert({ 
      date: today, 
      report_count: count + 1,
      alert_sent: usage ? usage.alert_sent : false
    }, { onConflict: 'date' });

  if (updateError) {
    console.error('Error incrementing daily usage:', updateError);
  }

  // Check alert
  const alertAt = Math.floor(DAILY_REPORT_LIMIT * ALERT_THRESHOLD_PERCENT / 100);
  if (count + 1 >= alertAt && (!usage || !usage.alert_sent)) {
    await sendAlert(count + 1);
    await supabase
      .from('daily_usage')
      .update({ alert_sent: true })
      .eq('date', today);
  }

  return { allowed: true, message: 'ok' };
}

async function sendAlert(count: number): Promise<void> {
  if (!ALERT_WEBHOOK_URL) return;
  
  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `PodcastFactChecker: ${count}/${DAILY_REPORT_LIMIT} reports used today.`,
      }),
    });
  } catch (error) {
    console.error('Error sending alert:', error);
  }
}
