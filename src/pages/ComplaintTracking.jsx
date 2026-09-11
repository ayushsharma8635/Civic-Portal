import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search, MapPin, QrCode, Star, Clock, Building2, Loader2, AlertTriangle, Lightbulb, Calendar, FileText,
} from "lucide-react";
import moment from "moment";
import { base44 } from "@/api/base44Client";
import { showToast } from "@/lib/toast";
import ComplaintMap from "@/components/ComplaintMap";
import StatusBadge from "@/components/StatusBadge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isComplaintDelayed, formatExpectedResolution } from "@/lib/resolutionConfig";
import { generateComplaintReceipt } from "@/lib/pdfReceipt";

const TIMELINE_STAGES = [
  { status: "Pending", label: "Complaint Submitted" },
  { status: "In Review", label: "Complaint Verified" },
  { status: "In Progress", label: "Assigned to Department" },
  { status: "In Progress", label: "Work Started" },
  { status: "Resolved", label: "Resolved" },
];

export default function ComplaintTracking() {
  const [params, setParams] = useSearchParams();
  const [searchId, setSearchId] = useState(params.get("id") || "");
  const [complaint, setComplaint] = useState(null);
  const [mediaList, setMediaList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ rating: 0, comment: "" });
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [submittingFb, setSubmittingFb] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const load = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const c = await base44.entities.Complaint.get(id);
      setComplaint(c);
      try {
        const res = await base44.entities.ComplaintMedia.filter({ complaint_id: id });
        setMediaList(res.items || res || []);
      } catch {
        setMediaList([]);
      }
      try {
        const fbs = await base44.entities.Feedback.filter({ complaint_id: id });
        const arr = fbs.items || fbs || [];
        if (arr.length) setExistingFeedback(arr[0]);
      } catch {}
    } catch (e) {
      setComplaint(null);
      showToast("Complaint not found", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = params.get("id");
    if (id) load(id);
  }, [params]);

  const doSearch = () => {
    if (searchId) setParams({ id: searchId });
  };

  const submitFeedback = async () => {
    if (feedback.rating < 1) {
      showToast("Please select a rating", "warning");
      return;
    }
    setSubmittingFb(true);
    try {
      const created = await base44.entities.Feedback.create({
        complaint_id: complaint.id, rating: feedback.rating, comment: feedback.comment,
      });
      setExistingFeedback(created);
      showToast("Thank you for your feedback!", "success");
    } catch (e) {
      showToast("Failed to submit feedback: " + e.message, "error");
    } finally {
      setSubmittingFb(false);
    }
  };

  const downloadPdf = async () => {
    if (!complaint) return;
    setDownloading(true);
    try {
      await generateComplaintReceipt(complaint, user);
    } catch (e) {
      showToast("Receipt download failed: " + e.message, "error");
    } finally {
      setDownloading(false);
    }
  };

  const qrUrl = complaint
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(window.location.origin + "/track?id=" + complaint.id)}`
    : "";

  const timeline = complaint?.timeline || [];
  const delayed = isComplaintDelayed(complaint);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Track Complaint</h1>
        <p className="text-muted-foreground text-sm">Search by complaint ID to view status and timeline.</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Enter complaint ID"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
        />
        <Button onClick={doSearch}><Search className="h-4 w-4 mr-2" /> Search</Button>
      </div>

      {loading && (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      )}

      {!loading && !complaint && (
        <Card><CardContent className="py-16 text-center text-muted-foreground text-sm">Enter a complaint ID above to begin tracking.</CardContent></Card>
      )}

      {!loading && complaint && (
        <>
          {delayed && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-700 dark:text-rose-300">This complaint is taking longer than expected.</p>
                  <p className="text-sm text-rose-600 dark:text-rose-400 mt-0.5">
                    Expected resolution was {complaint.expected_date ? moment(complaint.expected_date).format("DD MMM YYYY") : "—"}.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{complaint.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">ID: {complaint.complaint_code || complaint.id}</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {delayed && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">
                      Delayed
                    </span>
                  )}
                  <StatusBadge status={complaint.status} />
                  <StatusBadge status={complaint.priority} type="priority" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground whitespace-pre-wrap">{complaint.description}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-4 w-4" /> Department: <span className="text-foreground">{complaint.department || "Not assigned yet"}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /> {complaint.area || complaint.location || "No address"}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> Submitted: <span className="text-foreground">{moment(complaint.created_date).format("lll")}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" /> Expected: <span className="text-foreground">{complaint.expected_date ? moment(complaint.expected_date).format("ll") : formatExpectedResolution(complaint.estimated_days)}</span></div>
              </div>
              {complaint.remarks && (
                <div className="bg-muted/50 p-3 rounded-lg text-sm"><span className="font-medium">Admin remarks:</span> {complaint.remarks}</div>
              )}
              {complaint.ai_summary && (
                <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-lg text-sm text-indigo-700 dark:text-indigo-300"><span className="font-medium">AI summary:</span> {complaint.ai_summary}</div>
              )}

              {mediaList.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Evidence</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {mediaList.map((m) => (
                      <div key={m.id} className="rounded-lg overflow-hidden border border-border">
                        {m.media_type === "photo" ? (
                          <img src={m.file_url} alt="evidence" className="h-28 w-full object-cover" />
                        ) : (
                          <video src={m.file_url} className="h-28 w-full object-cover" controls />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={downloadPdf} disabled={downloading}>
                {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Download Complaint Receipt (PDF)
              </Button>
            </CardContent>
          </Card>

          {complaint.temporary_solution && (
            <Card className="border-amber-200 dark:border-amber-500/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" /> Temporary Solution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-foreground">{complaint.temporary_solution}</p>
                {complaint.temp_alt_route && (
                  <p className="text-muted-foreground"><span className="font-medium text-foreground">Alternate Route:</span> {complaint.temp_alt_route}</p>
                )}
                {complaint.temp_alt_facility && (
                  <p className="text-muted-foreground"><span className="font-medium text-foreground">Alternative Facility:</span> {complaint.temp_alt_facility}</p>
                )}
                {complaint.temp_availability_time && (
                  <p className="text-muted-foreground"><span className="font-medium text-foreground">Availability:</span> {complaint.temp_availability_time}</p>
                )}
                {complaint.temp_contact && (
                  <p className="text-muted-foreground"><span className="font-medium text-foreground">Contact:</span> {complaint.temp_contact}</p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Status Timeline</CardTitle></CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No updates yet.</p>
                ) : (
                  <ol className="relative border-l-2 border-border ml-2 space-y-5">
                    {[...timeline].reverse().map((t, i) => (
                      <li key={i} className="ml-5">
                        <span className="absolute -left-[9px] mt-1 h-4 w-4 rounded-full bg-primary ring-4 ring-background" />
                        <p className="font-medium text-sm text-foreground">{t.status}</p>
                        {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">{moment(t.timestamp).format("lll")}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><QrCode className="h-4 w-4" /> Tracking QR</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center">
                <img src={qrUrl} alt="QR code" className="h-40 w-40 rounded-lg border border-border" />
                <p className="text-xs text-muted-foreground mt-2 text-center">Scan to open this tracking page.</p>
              </CardContent>
            </Card>
          </div>

          {complaint.latitude != null && (
            <Card>
              <CardHeader><CardTitle className="text-base">Location</CardTitle></CardHeader>
              <CardContent>
                <ComplaintMap position={{ lat: complaint.latitude, lng: complaint.longitude }} height="280px" />
              </CardContent>
            </Card>
          )}

          {complaint.status === "Resolved" && (
            <Card>
              <CardHeader><CardTitle className="text-base">Rate this resolution</CardTitle></CardHeader>
              <CardContent>
                {existingFeedback ? (
                  <div className="text-center py-4">
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`h-6 w-6 ${s <= existingFeedback.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                    {existingFeedback.comment && <p className="text-sm text-muted-foreground mt-2">"{existingFeedback.comment}"</p>}
                    <p className="text-xs text-emerald-600 mt-2">Feedback submitted — thank you!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} onClick={() => setFeedback((f) => ({ ...f, rating: s }))} type="button">
                          <Star className={`h-7 w-7 transition-colors ${s <= feedback.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground hover:text-amber-300"}`} />
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="comment">Comment (optional)</Label>
                      <Textarea id="comment" rows={2} value={feedback.comment} onChange={(e) => setFeedback((f) => ({ ...f, comment: e.target.value }))} placeholder="Tell us about your experience..." />
                    </div>
                    <Button onClick={submitFeedback} disabled={submittingFb}>
                      {submittingFb && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Submit Feedback
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}