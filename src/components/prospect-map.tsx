"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LMap } from "leaflet";

export interface MapPoint { id: string; name: string; lat: number; lng: number; color: string; detail: string }

const ROUEN: [number, number] = [49.4432, 1.0993];

/** Carte Leaflet (fond OpenStreetMap). Un point par prospect, coloré selon son étape ; un clic ouvre la fiche. */
export default function ProspectMap({ points, onOpen }: { points: MapPoint[]; onOpen: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const open = useRef(onOpen);
  useEffect(() => { open.current = onOpen; }, [onOpen]);
  const fitted = useRef(false);
  const pointsRef = useRef(points);
  const redraw = useRef<(() => void) | null>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !el.current || map.current) return;
      const m = L.map(el.current, { center: ROUEN, zoom: 13, zoomControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>" }).addTo(m);
      const group = L.layerGroup().addTo(m);
      map.current = m;
      redraw.current = () => {
        const pts = pointsRef.current;
        group.clearLayers();
        for (const p of pts) {
          const mk = L.circleMarker([p.lat, p.lng], { radius: 9, color: "#ffffff", weight: 2, fillColor: p.color, fillOpacity: 0.95 });
          mk.bindTooltip(`<strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.detail)}`, { direction: "top", offset: [0, -6] });
          mk.on("click", () => open.current(p.id));
          mk.addTo(group);
        }
        if (pts.length > 0 && !fitted.current) { m.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 }); fitted.current = true; }
        if (el.current) el.current.dataset.count = String(pts.length);
      };
      if (el.current) el.current.dataset.ready = "1";
      redraw.current();
    })();
    return () => { dead = true; map.current?.remove(); map.current = null; redraw.current = null; fitted.current = false; };
  }, []);

  useEffect(() => { pointsRef.current = points; redraw.current?.(); }, [points]);

  return <div ref={el} className="h-full min-h-80 w-full rounded-2xl border border-border" role="application" aria-label="Carte des prospects" />;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
