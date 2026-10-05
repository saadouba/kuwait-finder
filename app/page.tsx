"use client";

import { useState, useEffect } from 'react';
import { Search, MapPin, Calendar, ExternalLink, Info, Map as MapIcon, Loader2 } from 'lucide-react';

interface EventItem {
  title: string;
  date: string;
  location: string;
  short_description: string;
  source_url: string;
}

interface Place {
  id: number;
  name?: string;
  title?: string;
  description?: string;
  location_url?: string;
  [key: string]: any;
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsNote, setEventsNote] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [errorEvents, setErrorEvents] = useState("");

  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [errorPlaces, setErrorPlaces] = useState("");

  const exampleQuestions = [
    "events this weekend",
    "family activities",
    "free things to do"
  ];

  const handleAsk = async (q: string) => {
    if (!q) return;
    setQuestion(q);
    setLoadingEvents(true);
    setErrorEvents("");
    setEvents([]);
    setEventsNote(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch events');
      }

      setEvents(data.items || []);
      setEventsNote(data.note || null);
    } catch (err: any) {
      setErrorEvents(err.message || 'An error occurred while finding events');
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    const fetchPlaces = async () => {
      setLoadingPlaces(true);
      setErrorPlaces("");
      try {
        const res = await fetch('/api/places');
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch places');
        }
        
        setPlaces(data.places || []);
      } catch (err: any) {
        setErrorPlaces(err.message || 'An error occurred while loading places');
      } finally {
        setLoadingPlaces(false);
      }
    };
    
    fetchPlaces();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-100 font-sans pb-20">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 shadow-sm sticky top-0 z-10 border-b border-slate-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-2">
          <MapIcon className="text-blue-600 dark:text-blue-400 w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight">Kuwait Finder</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8 space-y-16">
        {/* Events Search Section */}
        <section className="space-y-8">
          <div className="text-center space-y-4 max-w-2xl mx-auto mt-12">
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
              Discover Kuwait
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Find the best events, activities, and places happening around you.
            </p>
          </div>

          <div className="max-w-2xl mx-auto space-y-4">
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Ask about events, activities, or things to do..."
                className="w-full pl-12 pr-32 py-4 rounded-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg transition-all"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAsk(question)}
              />
              <button 
                onClick={() => handleAsk(question)}
                disabled={loadingEvents || !question.trim()}
                className="absolute right-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Search
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Try:</span>
              {exampleQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleAsk(q)}
                  className="px-3 py-1.5 text-sm rounded-full bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Events Results */}
          <div className="pt-8 min-h-[200px]">
            {loadingEvents ? (
              <div className="flex flex-col items-center justify-center text-slate-500 py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                <p>Searching for the best answers...</p>
              </div>
            ) : errorEvents ? (
              <div className="p-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-200 dark:border-red-800 text-center">
                <p>{errorEvents}</p>
              </div>
            ) : events.length > 0 ? (
              <div className="space-y-6">
                <h3 className="text-2xl font-bold border-b border-slate-200 dark:border-zinc-800 pb-2">Results</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  {events.map((event, idx) => (
                    <div key={idx} className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-zinc-800 hover:shadow-md transition-shadow flex flex-col h-full">
                      <h4 className="text-xl font-semibold mb-3">{event.title}</h4>
                      <p className="text-slate-600 dark:text-slate-400 mb-4 flex-grow">
                        {event.short_description}
                      </p>
                      
                      <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400 mb-4 mt-auto pt-4 border-t border-slate-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{event.date || 'Date not confirmed'}</span>
                        </div>
                        {event.location && event.location !== 'unknown' && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                      </div>
                      
                      {event.source_url && (
                        <a 
                          href={event.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mt-2"
                        >
                          Source <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                {eventsNote && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800 text-sm">
                    {eventsNote}
                  </div>
                )}
              </div>
            ) : question && !loadingEvents ? (
              <div className="text-center py-12 text-slate-500">
                <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No results found. Try asking something else!</p>
              </div>
            ) : null}
          </div>
        </section>

        {/* Places Section */}
        <section className="space-y-6 pt-12 border-t border-slate-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold tracking-tight">Popular Places</h2>
          </div>

          {loadingPlaces ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : errorPlaces ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-center">
              <p>{errorPlaces}</p>
            </div>
          ) : places.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {places.map((place, idx) => (
                <div key={place.id || idx} className="group bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all">
                  <div className="p-6">
                    <h3 className="text-lg font-bold mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {place.name || place.title || 'Unnamed Place'}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-3 mb-4">
                      {place.description || 'No description available.'}
                    </p>
                    
                    {place.location_url && (
                      <a 
                        href={place.location_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        <MapPin className="w-4 h-4" /> View on map
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 bg-slate-100 dark:bg-zinc-900/50 rounded-2xl">
              <p>No places found.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
