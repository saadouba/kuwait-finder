import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { question } = await req.json();
    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // 1) Check the Supabase "cache" table; if the same question exists and is under 1 hour old, return it.
    const todayString = new Date().toISOString().split('T')[0];
    const cacheKey = `${question}_${todayString}`;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: cacheData, error: cacheError } = await supabase
      .from('cache')
      .select('*')
      .eq('question', cacheKey)
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cacheData && cacheData.results) {
      if (Array.isArray(cacheData.results)) {
        return NextResponse.json({ items: cacheData.results, note: null });
      }
      return NextResponse.json(cacheData.results);
    }

    // 2) Run 3 Tavily searches in parallel
    const queries = [
      `${question} Kuwait`,
      `${question} Kuwait events activities`,
      `${question} الكويت فعاليات`
    ];

    const fetchTavily = async (q: string) => {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: q,
            search_depth: 'advanced',
            include_answer: false,
            max_results: 5,
            topic: 'news',
            days: 30
          }),
        });
        if (!res.ok) return { results: [] };
        return res.json();
      } catch (e) {
        return { results: [] };
      }
    };

    const tavilyResponses = await Promise.all(queries.map(fetchTavily));
    
    // Merge results, remove duplicate URLs, max 3 per domain
    const allResults = tavilyResponses.flatMap(r => r.results || []);
    const urlSet = new Set();
    const domainCount: Record<string, number> = {};
    const filteredResults = [];

    for (const res of allResults) {
      if (!res || !res.url) continue;
      if (urlSet.has(res.url)) continue;
      
      try {
        const domain = new URL(res.url).hostname;
        domainCount[domain] = (domainCount[domain] || 0) + 1;
        if (domainCount[domain] > 3) continue;
      } catch (e) {
        continue;
      }
      
      urlSet.add(res.url);
      filteredResults.push(res);
    }

    if (filteredResults.length === 0) {
      return NextResponse.json({ items: [], note: "No events found." });
    }

    // 3) Send results to Groq (llama-3.3-70b-versatile) with JSON mode
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content: `You are an event and places extraction assistant. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}, ${todayString}.
Based on the provided search results, extract up to 5 events or activities in Kuwait. 
Rules:
1. Only include events that happen on or after today (${todayString}).
2. Only include events located in Kuwait.
3. Skip any result whose source is about another country.
4. Never guess dates or locations. If a field is not in the source text, use null.
5. If the question mentions "this weekend", "today", "tonight", or "this week", compute that date range from today's date and only include events inside that range.
6. Prefer family, entertainment, culture, sports, and food events over business or academic conferences, unless the user asks for them.
7. If fewer than 3 events match, include a "note" explaining that not enough confirmed events were found.

Respond ONLY with a JSON object in this format:
{
  "items": [
    {
      "title": "Event Name",
      "date": "Event Date or null",
      "location": "Event Location or null",
      "short_description": "Brief 1-2 sentence description",
      "source_url": "URL from the search result"
    }
  ],
  "note": "A string note or null"
}`
          },
          {
            role: 'user',
            content: `Search Results:\n${JSON.stringify(filteredResults.map((r: any) => ({
              title: r.title,
              url: r.url,
              content: r.content
            })))}`
          }
        ],
        response_format: { type: 'json_object' },
        reasoning_effort: 'low'
      }),
    });
    if (!groqResponse.ok) {
      const errorBody = await groqResponse.text();
      console.error(`Groq API error ${groqResponse.status}:`, errorBody);
      throw new Error(`Failed to fetch from Groq API (Status: ${groqResponse.status}): ${errorBody}`);
    }
    
    const groqData = await groqResponse.json();
    let parsedItems = { items: [] };
    
    try {
      let contentStr = groqData.choices[0].message.content;
      const jsonMatch = contentStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        contentStr = jsonMatch[1];
      }
      const start = contentStr.indexOf('{');
      const end = contentStr.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end >= start) {
        contentStr = contentStr.substring(start, end + 1);
      }
      parsedItems = JSON.parse(contentStr);
    } catch (e) {
      console.error('Failed to parse Groq response', e);
    }

    // 4) Save to cache and return
    // Assuming table 'cache' has columns: question (text), results (jsonb), created_at (timestamptz)
    await supabase
      .from('cache')
      .insert({ question: cacheKey, results: parsedItems });

    return NextResponse.json(parsedItems);

  } catch (error: any) {
    console.error('Error in ask route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
