import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, MapPin, Loader2, Wand2, AlertTriangle, Clock } from "lucide-react";
import { api } from "@/api/supabaseClient";
import { showToast } from "@/lib/toast";
import LocationPicker from "@/components/LocationPicker";
import EvidenceCapture from "@/components/EvidenceCapture";
import StatusBadge from "@/components/StatusBadge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  estimateResolutionDays, computeExpectedDate, formatExpectedResolution,
} from "@/lib/resolutionConfig";

const CATEGORIES = ["Road Damage", "Garbage Collection", "Street Light", "Water Leakage", "Drainage", "Electricity", "Stray Animals", "Illegal Parking", "Public Safety", "Other"];

export default function SubmitComplaint() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "", description: "", category: "Road Damage",
    location: "", area: "", area_id: "", location_name: "", formatted_address: "", google_place_id: "",
    latitude: null, longitude: null,
  });
  const [media, setMedia] = useState([]);
  const [ai, setAi] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const estimatedDays = useMemo(() => estimateResolutionDays(form.category), [form.category]);

  const analyze = async () => {
    if (!form.title || !form.description) {
      showToast("Add a title and description first", "warning");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await api.functions.invoke("analyzeComplaint", {
        title: form.title, description: form.description, category: form.category,
      });
      const data = res.data || res;
      setAi(data);
      showToast("AI analysis complete", "success");
    } catch (err) {
      showToast("AI analysis failed: " + err.message, "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const generateCode = () => {
    const yr = new Date().getFullYear();
    const rnd = String(Math.floor(1000 + Math.random() * 9000));
    return `CP${yr}${rnd}`;
  };

  const submit = async () => {
    if (!form.title || !form.description) {
      showToast("Title and description are required", "warning");
      return;
    }
    if (!form.area) {
      showToast("Please select your area/locality", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const expectedDate = computeExpectedDate(now, estimatedDays);
      const complaint = {
        ...form,
        priority: ai?.priority || "Medium",
        department: ai?.suggested_department || "",
        ai_summary: ai?.ai_summary || "",
        is_spam: ai?.is_spam || false,
        duplicate_of: ai?.duplicate_of || "",
        status: "Pending",
        complaint_code: generateCode(),
        estimated_days: estimatedDays,
        expected_date: expectedDate,
        is_delayed: false,
        timeline: [{ status: "Pending", note: "Complaint submitted by citizen", timestamp: now }],
      };
      const created = await api.entities.Complaint.create(complaint);

      // Save media records linked to the complaint
      if (media.length) {
        await api.entities.ComplaintMedia.bulkCreate(
          media.map((m) => ({ ...m, complaint_id: created.id }))
        );
      }

      await api.entities.Notification.create({
        title: "Complaint submitted",
        message: `Your complaint "${form.title}" has been received. Expected resolution: ${formatExpectedResolution(estimatedDays)}.`,
        type: "system",
        complaint_id: created.id,
      });

      showToast("Complaint submitted successfully", "success");
      navigate(`/track?id=${created.id}`);
    } catch (err) {
      showToast("Submission failed: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Submit a Complaint</h1>
        <p className="text-muted-foreground text-sm">Report a local civic issue with evidence and location.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Complaint Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Large pothole near MG Road junction" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe the issue, how long it's been there, and any safety risk..." />
          </div>
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-500" /> Select Complaint Location</CardTitle></CardHeader>
        <CardContent>
          <LocationPicker
            onSelect={(loc) => {
              setForm((f) => ({
                ...f,
                area: loc.area_name,
                area_id: loc.area_id,
                location_name: loc.location_name,
                formatted_address: loc.formatted_address,
                location: loc.formatted_address || loc.location_name,
                google_place_id: loc.google_place_id,
                latitude: loc.latitude,
                longitude: loc.longitude,
              }));
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evidence (Photo / Video)</CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenceCapture media={media} onMediaChange={setMedia} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-indigo-500" /> Estimated Resolution Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
            <Clock className="h-5 w-5 text-indigo-500" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Expected Resolution: {formatExpectedResolution(estimatedDays)}
              </p>
              <p className="text-xs text-muted-foreground">
                Based on category "{form.category}". Admins can adjust this per complaint.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-500" /> AI Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" onClick={analyze} disabled={analyzing}>
            {analyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Analyze with AI
          </Button>
          {ai && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={ai.priority} type="priority" />
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  Dept: {ai.suggested_department}
                </span>
                {ai.is_spam && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">
                    <AlertTriangle className="h-3 w-3" /> Flagged as spam
                  </span>
                )}
                {ai.duplicate_of && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                    Possible duplicate
                  </span>
                )}
              </div>
              {ai.ai_summary && (
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">"{ai.ai_summary}"</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/")}>Cancel</Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Submit Complaint
        </Button>
      </div>
    </div>
  );
}