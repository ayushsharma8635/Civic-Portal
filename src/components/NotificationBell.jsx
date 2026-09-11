import React, { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import moment from "moment";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef(null);

  const load = async () => {
    try {
      const user = await base44.auth.me();
      const complaintsRes = await base44.entities.Complaint.list("-created_date", 500);
      const myComplaintIds = new Set(
        (complaintsRes.items || complaintsRes || [])
          .filter((c) => c.created_by_id === user.id)
          .map((c) => c.id)
      );
      const res = await base44.entities.Notification.list("-created_date", 50);
      const all = res.items || res || [];
      setNotifications(all.filter((n) => !n.complaint_id || myComplaintIds.has(n.complaint_id)));
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Notification.subscribe(() => load());
    return unsub;
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = notifications.filter((n) => !n.is_read).length;

  const markRead = async (id) => {
    try {
      await base44.entities.Notification.update(id, { is_read: true });
      setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {}
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;
    try {
      await base44.entities.Notification.bulkUpdate(unreadIds.map((id) => ({ id, is_read: true })));
      setNotifications((ns) => ns.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  const remove = async (id) => {
    try {
      await base44.entities.Notification.delete(id);
      setNotifications((ns) => ns.filter((n) => n.id !== id));
    } catch {}
  };

  const clearAll = async () => {
    if (!notifications.length) return;
    try {
      await base44.entities.Notification.deleteMany({});
      setNotifications([]);
    } catch {}
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative h-9 w-9 grid place-items-center rounded-md hover:bg-accent text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4.5 min-w-4.5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center" style={{ minWidth: 18, height: 18 }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-popover shadow-xl z-50 flex flex-col max-h-[70vh]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm">Notifications</p>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs h-7">
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7 text-destructive ml-auto">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear all
            </Button>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground text-center">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No notifications.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-border last:border-0 flex gap-2 ${!n.is_read ? "bg-primary/5" : ""}`}
                >
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{moment(n.created_date).fromNow()}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!n.is_read && (
                      <button onClick={() => markRead(n.id)} className="text-muted-foreground hover:text-emerald-600" title="Mark as read">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => remove(n.id)} className="text-muted-foreground hover:text-destructive" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}