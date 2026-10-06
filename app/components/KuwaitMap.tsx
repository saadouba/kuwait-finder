"use client";

import { useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import { ExternalLink, MapPin } from "lucide-react";

type Category = "Events" | "Places" | "Restaurants & Cafes" | "Family Activities";
type MapItem = {
  id: string;
  title: string;
  date: string | null;
  location: string;
  description: string;
  category: Category;
  source_url: string | null;
  isSample: boolean;
  latitude: number | null;
  longitude: number | null;
};

type Props = {
  items: MapItem[];
  language: "en" | "ar";
};

const text = {
  en: {
    selected: "Selected place",
    sample: "SAMPLE DATA · NOT A REAL EVENT",
    dateUnknown: "Date not confirmed",
    source: "Source",
    empty: "No verified map pins in this category yet.",
    mapLabel: "Map of curated Kuwait places and events",
  },
  ar: {
    selected: "المكان المحدد",
    sample: "بيانات تجريبية · ليست فعالية حقيقية",
    dateUnknown: "التاريخ غير مؤكد",
    source: "المصدر",
    empty: "لا توجد نقاط مؤكدة لهذه الفئة على الخريطة بعد.",
    mapLabel: "خريطة الأماكن والفعاليات المختارة في الكويت",
  },
} as const;

function categoryName(category: Category, language: "en" | "ar") {
  if (language === "en") {
    if (category === "Places") return "Places to visit";
    if (category === "Restaurants & Cafes") return "Restaurants & cafes";
    if (category === "Family Activities") return "Family activities";
    return "Events";
  }
  if (category === "Places") return "أماكن للزيارة";
  if (category === "Restaurants & Cafes") return "مطاعم ومقاهي";
  if (category === "Family Activities") return "أنشطة عائلية";
  return "فعاليات";
}

function dateLabel(date: string | null, language: "en" | "ar") {
  if (!date) return text[language].dateUnknown;
  return new Date(`${date}T12:00:00.000Z`).toLocaleDateString(language === "ar" ? "ar-KW" : "en-US", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuwait",
  });
}

export default function KuwaitMap({ items, language }: Props) {
  const isArabic = language === "ar";
  const t = text[language];
  const [selected, setSelected] = useState<MapItem | null>(null);
  const pins = useMemo(() => items.filter((item) => item.latitude !== null && item.longitude !== null), [items]);
  const selectedVisible = selected && pins.some((item) => item.id === selected.id) ? selected : null;
  const icons = useMemo(() => ({
    verified: L.divIcon({
      className: "kuwait-map-pin-shell",
      html: "<span class=\"kuwait-map-pin\"><span></span></span>",
      iconSize: [34, 42], iconAnchor: [17, 39], popupAnchor: [0, -36],
    }),
    sample: L.divIcon({
      className: "kuwait-map-pin-shell",
      html: "<span class=\"kuwait-map-pin kuwait-map-pin-sample\"><span></span></span>",
      iconSize: [34, 42], iconAnchor: [17, 39], popupAnchor: [0, -36],
    }),
  }), []);

  return (
    <div className="map-frame" dir={isArabic ? "rtl" : "ltr"}>
      {selectedVisible && (
        <article className="map-focus-card glass-card" aria-live="polite">
          <div className="map-focus-heading"><MapPin size={15} /><span>{t.selected}</span></div>
          <span className="category-tag">{categoryName(selectedVisible.category, language)}</span>
          <h3>{selectedVisible.title}</h3>
          {selectedVisible.isSample && <span className="sample-badge">{t.sample}</span>}
          <p>{selectedVisible.description}</p>
          {selectedVisible.source_url && <a href={selectedVisible.source_url} target="_blank" rel="noopener noreferrer">{t.source}<ExternalLink size={13} /></a>}
        </article>
      )}
      {pins.length === 0 ? (
        <div className="map-empty glass-card"><MapPin size={24} /><p>{t.empty}</p></div>
      ) : (
        <MapContainer
          className="kuwait-leaflet-map"
          center={[29.3759, 47.9774]}
          zoom={11}
          scrollWheelZoom={false}
          aria-label={t.mapLabel}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          {pins.map((item) => (
            <Marker
              key={item.id}
              position={[item.latitude as number, item.longitude as number]}
              icon={item.isSample ? icons.sample : icons.verified}
              title={item.title}
              eventHandlers={{ click: () => setSelected(item) }}
            >
              <Popup>
                <div className="map-popup-content" dir={isArabic ? "rtl" : "ltr"}>
                  <span>{categoryName(item.category, language)}</span>
                  <strong>{item.title}</strong>
                  {item.isSample && <b className="map-popup-sample">{t.sample}</b>}
                  {item.category === "Events" && <small>{dateLabel(item.date, language)}</small>}
                  <p>{item.description}</p>
                  {item.source_url && <a href={item.source_url} target="_blank" rel="noopener noreferrer">{t.source}<ExternalLink size={12} /></a>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
}
