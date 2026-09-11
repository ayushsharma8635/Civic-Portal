import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { api } from "@/api/supabaseClient";
import { Input } from "@/components/ui/input";

export default function AreaSearch({ value, onSelect }) {
  const [query, setQuery] = useState(value || "");
  const [areas, setAreas] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usingGps, setUsingGps] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.entities.Area.list();
        const list = res.items || res || [];
        setAreas(list);
        setFiltered(list);
      } catch {
        setAreas([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(areas);
      return;
    }
    const q = query.toLowerCase();
    setFiltered(
      areas.filter((a) =>
        [a.name, a.ward, a.landmark].filter(Boolean).some((v) => v.toLowerCase().includes(q))
      )
    );
  }, [query, areas]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const useGps = () => {
    if (!navigator.geolocation) return;
    setUsingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onSelect({ name: "Current GPS Location", latitude, longitude });
        setQuery("Current GPS Location");
        setOpen(false);
        setUsingGps(false);
      },
      () => {
        setUsingGps(false);
      }
    );
  };

  const pick = (area) => {
    setQuery(area.name);
    onSelect(area);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search area, locality, ward, or landmark..."
          className="pl-10 h-11"
        />
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading areas...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No areas found.</div>
          ) : (
            <>
              <button
                onClick={useGps}
                disabled={usingGps}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-accent border-b border-border"
              >
                {usingGps ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4 text-indigo-500" />}
                Use my current location (GPS)
              </button>
              {filtered.map((a) => (
                <button
                  key={a.id}
                  onClick={() => pick(a)}
                  className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-accent"
                >
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{a.name}</p>
                    {(a.ward || a.landmark) && (
                      <p className="text-xs text-muted-foreground">
                        {[a.ward && `Ward: ${a.ward}`, a.landmark && `Near ${a.landmark}`].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}