import React, { useRef, useState } from "react";
import { Camera, Video, Upload, X, Loader2, Film } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

const MAX_PHOTO = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO = 25 * 1024 * 1024; // 25MB
const PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];

export default function EvidenceCapture({ media, onMediaChange }) {
  const { toast } = useToast();
  const photoCamRef = useRef(null);
  const videoCamRef = useRef(null);
  const photoUpRef = useRef(null);
  const videoUpRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const validate = (file, isVideo) => {
    const allowed = isVideo ? VIDEO_TYPES : PHOTO_TYPES;
    const max = isVideo ? MAX_VIDEO : MAX_PHOTO;
    if (!allowed.includes(file.type)) {
      toast({
        title: "Unsupported file type",
        description: `Allowed: ${isVideo ? "MP4, WebM" : "JPG, JPEG, PNG"}`,
        variant: "destructive",
      });
      return false;
    }
    if (file.size > max) {
      toast({
        title: "File too large",
        description: `Max ${isVideo ? "25MB" : "5MB"}.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleFile = async (file, isVideo) => {
    if (!file) return;
    if (!validate(file, isVideo)) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const item = {
        media_type: isVideo ? "video" : "photo",
        file_url,
        file_name: file.name,
      };
      onMediaChange([...(media || []), item]);
      toast({ title: `${isVideo ? "Video" : "Photo"} added` });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = (idx) => {
    onMediaChange((media || []).filter((_, i) => i !== idx));
  };

  const Btn = ({ icon: Icon, label, onClick }) => (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={uploading} className="flex-1">
      <Icon className="h-4 w-4 mr-1.5" /> {label}
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Btn icon={Camera} label="Take Photo" onClick={() => photoCamRef.current?.click()} />
        <Btn icon={Video} label="Record Video" onClick={() => videoCamRef.current?.click()} />
        <Btn icon={Upload} label="Upload Photo" onClick={() => photoUpRef.current?.click()} />
        <Btn icon={Film} label="Upload Video" onClick={() => videoUpRef.current?.click()} />
      </div>

      {/* hidden inputs — capture attribute opens device camera on mobile */}
      <input
        ref={photoCamRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0], false)}
      />
      <input
        ref={videoCamRef}
        type="file"
        accept="video/mp4,video/webm"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0], true)}
      />
      <input
        ref={photoUpRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0], false)}
      />
      <input
        ref={videoUpRef}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0], true)}
      />

      {uploading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
        </div>
      )}

      {media && media.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {media.map((m, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden border border-border">
              {m.media_type === "photo" ? (
                <img src={m.file_url} alt="evidence" className="h-28 w-full object-cover" />
              ) : (
                <video src={m.file_url} className="h-28 w-full object-cover" controls />
              )}
              <span className="absolute bottom-1 left-1 text-[10px] uppercase font-medium px-1.5 py-0.5 rounded bg-black/60 text-white">
                {m.media_type}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}