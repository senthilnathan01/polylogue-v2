import { supabase } from '../supabase';
import { Report, LengthType, Claim } from '../types';
import { format } from 'date-fns';

export async function getCachedReport(url: string, lengthType: LengthType): Promise<Report | null> {
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('youtube_url', url)
    .eq('length_type', lengthType)
    .gte('created_at', `${today}T00:00:00Z`)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Report;
}

export async function saveReport(report: Partial<Report>): Promise<string | null> {
  const { data, error } = await supabase
    .from('reports')
    .insert(report)
    .select('id')
    .single();

  if (error) {
    console.error('Error saving report:', error);
    return null;
  }

  return data.id;
}

export async function getReportById(id: string): Promise<Report | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Report;
}

export async function getReportClaims(reportId: string): Promise<Claim[]> {
  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .eq('report_id', reportId);

  if (error || !data) {
    return [];
  }

  return data as Claim[];
}
