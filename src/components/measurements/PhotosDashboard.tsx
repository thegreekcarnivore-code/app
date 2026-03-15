import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { format } from "date-fns";
import { Camera, ImageUp, Columns2, Trash2, Info, CalendarIcon, RefreshCw, Pencil, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import PhotoComparison from "./PhotoComparison";
import { getSignedUrls, type SignedUrlResult } from "@/lib/storage";

interface PhotosDashboardProps {
  userId?: string;
}

const angles = [
  { key: "front", en: "Front", el: "Μπροστά" },
  { key: "back", en: "Back", el: "Πίσω" },
  { key: "side", en: "Side", el: "Πλάι" },
];

type PhotoStatus = "loading" | "ready" | "missing";

async function convertToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), "image/jpeg", 0.85)
  );
}

const PhotosDashboard = ({ userId }: PhotosDashboardProps) => {
  const { user, isAdmin } = useAuth();
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const targetUserId = userId || user?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const [uploadAngle, setUploadAngle] = useState("front");
  const [uploadDate, setUploadDate] = useState<Date>(new Date());
  const [uploading, setUploading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [comparisonPhotos, setComparisonPhotos] = useState<{ url1: string; url2: string } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [photoStatuses, setPhotoStatuses] = useState<Record<string, PhotoStatus>>({});
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["progress_photos", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      const { data, error } = await supabase
        .from("progress_photos")
        .select("*")
        .eq("user_id", targetUserId)
        .order("taken_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!targetUserId,
  });

  // Generate signed URLs when photos change — track per-photo status
  useEffect(() => {
    if (!photos.length) return;

    // Set all to loading initially
    const initialStatuses: Record<string, PhotoStatus> = {};
    for (const p of photos) initialStatuses[p.id] = "loading";
    setPhotoStatuses(initialStatuses);

    const paths = photos.map(p => p.photo_url);
    getSignedUrls("progress-photos", paths).then(urlMap => {
      const mapped: Record<string, string> = {};
      const statuses: Record<string, PhotoStatus> = {};
      for (const photo of photos) {
        const result = urlMap.get(photo.photo_url);
        if (result?.signedUrl) {
          mapped[photo.id] = result.signedUrl;
          statuses[photo.id] = "ready";
        } else {
          statuses[photo.id] = "missing";
        }
      }
      setSignedUrls(mapped);
      setPhotoStatuses(statuses);
    });
  }, [photos]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("progress_photos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress_photos", targetUserId] });
      toast({ title: lang === "en" ? "Photo deleted" : "Η φωτογραφία διαγράφηκε" });
    },
  });

  const updateDateMutation = useMutation({
    mutationFn: async ({ id, newDate }: { id: string; newDate: string }) => {
      const { error } = await supabase.from("progress_photos").update({ taken_at: newDate }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress_photos", targetUserId] });
      toast({ title: lang === "en" ? "Date updated" : "Η ημερομηνία ενημερώθηκε" });
    },
  });

  const [editingDatePhotoId, setEditingDatePhotoId] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !targetUserId) return;

    const fileArray = Array.from(files);
    const oversized = fileArray.filter(f => f.size > 10 * 1024 * 1024);
    if (oversized.length > 0) {
      toast({ title: lang === "en" ? `${oversized.length} file(s) too large (max 10MB each)` : `${oversized.length} αρχεία πολύ μεγάλα (μέγ. 10MB)`, variant: "destructive" });
      return;
    }

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of fileArray) {
      try {
        let jpegBlob: Blob;
        try {
          jpegBlob = await convertToJpeg(file);
        } catch {
          failCount++;
          continue;
        }

        const path = `${targetUserId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error: upErr } = await supabase.storage.from("progress-photos").upload(path, jpegBlob, { contentType: "image/jpeg" });
        if (upErr) { failCount++; continue; }

        const { error: dbErr } = await supabase.from("progress_photos").insert({
          user_id: targetUserId,
          photo_url: path,
          angle: uploadAngle,
          taken_at: format(uploadDate, "yyyy-MM-dd"),
        });
        if (dbErr) { failCount++; continue; }

        successCount++;
      } catch {
        failCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["progress_photos", targetUserId] });

    if (successCount > 0) {
      toast({ title: lang === "en" ? `${successCount} photo(s) uploaded` : `${successCount} φωτογραφία(-ες) μεταφορτώθηκαν` });
    }
    if (failCount > 0) {
      toast({ title: lang === "en" ? `${failCount} photo(s) failed` : `${failCount} φωτογραφία(-ες) απέτυχαν`, variant: "destructive" });
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetUserId || !replacingPhotoId) return;

    const photo = photos.find(p => p.id === replacingPhotoId);
    if (!photo) return;

    setUploading(true);
    try {
      let jpegBlob: Blob;
      try {
        jpegBlob = await convertToJpeg(file);
      } catch {
        toast({ title: lang === "en" ? "Could not process image" : "Δεν ήταν δυνατή η επεξεργασία της εικόνας", variant: "destructive" });
        return;
      }

      const path = `${targetUserId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("progress-photos").upload(path, jpegBlob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;

      // Update existing record to point to new file
      const { error: dbErr } = await supabase.from("progress_photos")
        .update({ photo_url: path })
        .eq("id", replacingPhotoId);
      if (dbErr) throw dbErr;

      queryClient.invalidateQueries({ queryKey: ["progress_photos", targetUserId] });
      toast({ title: lang === "en" ? "Photo replaced" : "Η φωτογραφία αντικαταστάθηκε" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setReplacingPhotoId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotos((prev) => {
      if (prev.includes(photoId)) return prev.filter((p) => p !== photoId);
      if (prev.length >= 2) return [prev[1], photoId];
      return [...prev, photoId];
    });
  };

  const startComparison = () => {
    if (selectedPhotos.length === 2) {
      const url1 = signedUrls[selectedPhotos[0]];
      const url2 = signedUrls[selectedPhotos[1]];
      if (url1 && url2) setComparisonPhotos({ url1, url2 });
    }
  };

  // Group photos by date
  const grouped = photos.reduce((acc, p) => {
    const d = p.taken_at;
    if (!acc[d]) acc[d] = [];
    acc[d].push(p);
    return acc;
  }, {} as Record<string, typeof photos>);

  if (comparisonPhotos) {
    return <PhotoComparison url1={comparisonPhotos.url1} url2={comparisonPhotos.url2} onClose={() => { setComparisonPhotos(null); setCompareMode(false); setSelectedPhotos([]); }} />;
  }

  return (
    <div className="space-y-4">
      {/* Hidden replace input */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        onChange={handleReplace}
        className="hidden"
      />

      {/* Tip banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-2 p-3">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-base font-sans text-foreground/80">
            {lang === "en"
              ? "For best comparison, use the same pose, lighting, and location each time."
              : "Για καλύτερη σύγκριση, χρησιμοποιήστε την ίδια πόζα, φωτισμό και τοποθεσία κάθε φορά."}
          </p>
        </CardContent>
      </Card>

      {/* Upload controls */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            {angles.map(({ key, en, el }) => (
              <button
                key={key}
                onClick={() => setUploadAngle(key)}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-base font-sans font-medium transition-colors",
                  uploadAngle === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {lang === "en" ? en : el}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal text-sm">
                  <CalendarIcon className="mr-1.5 h-4 w-4" />
                  {format(uploadDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={uploadDate} onSelect={(d) => d && setUploadDate(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <label className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-sans font-medium cursor-pointer transition-colors",
              "bg-primary text-primary-foreground hover:opacity-90",
              uploading && "opacity-50 pointer-events-none"
            )}>
              <Camera className="h-4 w-4" />
              {lang === "en" ? "Camera" : "Κάμερα"}
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleUpload} className="hidden" multiple />
            </label>

            <label className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-sans font-medium cursor-pointer transition-colors",
              "bg-secondary text-secondary-foreground hover:opacity-90",
              uploading && "opacity-50 pointer-events-none"
            )}>
              <ImageUp className="h-4 w-4" />
              {uploading ? (lang === "en" ? "Uploading..." : "Μεταφόρτωση...") : (lang === "en" ? "Upload" : "Άλμπουμ")}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" multiple />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Compare button */}
      {photos.length >= 2 && (
        <div className="flex gap-2">
          <Button
            variant={compareMode ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => { setCompareMode(!compareMode); setSelectedPhotos([]); }}
          >
            <Columns2 className="h-3.5 w-3.5" />
            {compareMode ? (lang === "en" ? "Cancel" : "Ακύρωση") : (lang === "en" ? "Compare" : "Σύγκριση")}
          </Button>
          {compareMode && selectedPhotos.length === 2 && (
            <Button size="sm" onClick={startComparison}>
              {lang === "en" ? "View Comparison" : "Προβολή Σύγκρισης"}
            </Button>
          )}
        </div>
      )}

      {compareMode && (
        <p className="text-base font-sans text-muted-foreground">
          {lang === "en" ? `Select 2 photos to compare (${selectedPhotos.length}/2)` : `Επιλέξτε 2 φωτογραφίες (${selectedPhotos.length}/2)`}
        </p>
      )}

      {/* Gallery grouped by date */}
      {Object.entries(grouped).map(([date, datePhotos]) => (
        <div key={date} className="space-y-2">
          <h4 className="text-base font-sans font-semibold text-muted-foreground uppercase tracking-wider">
            {new Date(date).toLocaleDateString(lang === "en" ? "en-GB" : "el-GR", { day: "numeric", month: "short", year: "numeric" })}
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {datePhotos.map((photo) => {
              const status = photoStatuses[photo.id] || "loading";

              return (
                <div
                  key={photo.id}
                  className={cn(
                    "relative group rounded-lg overflow-hidden aspect-[3/4]",
                    compareMode && status === "ready" && "cursor-pointer",
                    compareMode && selectedPhotos.includes(photo.id) && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}
                  onClick={() => {
                    if (status !== "ready") return;
                    if (compareMode) togglePhotoSelection(photo.id);
                    else if (signedUrls[photo.id]) setLightboxUrl(signedUrls[photo.id]);
                  }}
                >
                  {status === "ready" && signedUrls[photo.id] ? (
                    <img src={signedUrls[photo.id]} alt={photo.angle} className="h-full w-full object-cover cursor-pointer" />
                  ) : status === "missing" ? (
                    <div className="h-full w-full bg-muted flex flex-col items-center justify-center gap-2 p-2">
                      <p className="text-xs font-sans text-destructive font-medium text-center">
                        {lang === "en" ? "File missing" : "Λείπει αρχείο"}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplacingPhotoId(photo.id);
                          replaceInputRef.current?.click();
                        }}
                      >
                        <RefreshCw className="h-3 w-3" />
                        {lang === "en" ? "Replace" : "Αντικατάσταση"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(photo.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                        {lang === "en" ? "Delete" : "Διαγραφή"}
                      </Button>
                    </div>
                  ) : (
                    <div className="h-full w-full bg-muted animate-pulse" />
                  )}

                  {status === "ready" && (
                    <>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 flex items-center justify-between">
                        <span className="text-sm font-sans text-white capitalize">{photo.angle}</span>
                        {!compareMode && (
                          <Popover
                            open={editingDatePhotoId === photo.id}
                            onOpenChange={(open) => setEditingDatePhotoId(open ? photo.id : null)}
                          >
                            <PopoverTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-full bg-black/50 p-1 text-white transition-opacity hover:bg-black/70"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end" onClick={(e) => e.stopPropagation()}>
                              <Calendar
                                mode="single"
                                selected={new Date(photo.taken_at + "T00:00:00")}
                                onSelect={(d) => {
                                  if (d) {
                                    updateDateMutation.mutate({ id: photo.id, newDate: format(d, "yyyy-MM-dd") });
                                    setEditingDatePhotoId(null);
                                  }
                                }}
                                initialFocus
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                      {!compareMode && (
                        <div className="absolute top-1 right-1 flex gap-1">
                          {isAdmin && signedUrls[photo.id] && (
                            <a
                              href={signedUrls[photo.id]}
                              download={`progress-photo-${photo.angle}-${photo.taken_at}.jpg`}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-full bg-black/50 p-1 text-white transition-opacity hover:bg-black/70"
                              title={lang === "en" ? "Download" : "Λήψη"}
                            >
                              <Download className="h-3 w-3" />
                            </a>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-full bg-black/50 p-1 text-white transition-opacity hover:bg-black/70"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{lang === "en" ? "Delete photo?" : "Διαγραφή φωτογραφίας;"}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {lang === "en" ? "This action cannot be undone." : "Αυτή η ενέργεια δεν μπορεί να αναιρεθεί."}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{lang === "en" ? "Cancel" : "Ακύρωση"}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(photo.id)}>
                                  {lang === "en" ? "Delete" : "Διαγραφή"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {!isLoading && photos.length === 0 && (
        <p className="text-center text-base font-sans text-muted-foreground py-6">
          {lang === "en" ? "No progress photos yet" : "Δεν υπάρχουν φωτογραφίες ακόμα"}
        </p>
      )}

      {/* Photo Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 bg-background/95 backdrop-blur-sm border-border">
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt=""
              className="w-full h-full max-h-[80vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotosDashboard;
