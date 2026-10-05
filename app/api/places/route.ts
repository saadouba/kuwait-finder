import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // Return all rows from the "places" table
    const { data: places, error } = await supabase
      .from('places')
      .select('*');

    if (error) {
      throw error;
    }

    return NextResponse.json({ places });
  } catch (error: any) {
    console.error('Error in places route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
