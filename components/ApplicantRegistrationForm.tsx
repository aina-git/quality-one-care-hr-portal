"use client";

import { useRef, useState } from "react";
import { Camera, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ApplicantRegistrationForm({ csrfToken }: { csrfToken: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState(1);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoName, setPhotoName] = useState("camera-profile-photo.jpg");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoSource, setPhotoSource] = useState<"camera" | "upload">("upload");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  async function startCamera() {
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 720, height: 720, facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPhotoSource("camera");
    } catch {
      setMessage("Camera access was not available. Upload a passport-style JPG or PNG instead.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setMessage("Camera preview is not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(400, video.videoWidth);
    canvas.height = Math.max(400, video.videoHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setMessage("Photo capture failed. Please try again.");
        return;
      }
      setPhotoBlob(blob);
      setPhotoName("camera-profile-photo.jpg");
      setPhotoSource("camera");
      setPhotoPreview(URL.createObjectURL(blob));
      stopCamera();
    }, "image/jpeg", 0.92);
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setMessage("Upload a JPG or PNG passport-style photo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Photo must be 5MB or smaller.");
      return;
    }
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      if (image.width < 400 || image.height < 400) {
        setMessage("Photo resolution must be at least 400x400 pixels.");
        URL.revokeObjectURL(url);
        return;
      }
      setPhotoBlob(file);
      setPhotoName(file.name);
      setPhotoSource("upload");
      setPhotoPreview(url);
      setMessage("");
    };
    image.src = url;
  }

  async function createAccount() {
    setMessage("");
    if (!formRef.current) return;
    if (!photoBlob || !consent) {
      setMessage("Identity photo and consent are required before account creation.");
      return;
    }
    setBusy(true);
    const form = new FormData(formRef.current);
    form.set("csrfToken", csrfToken);
    form.set("photoSource", photoSource);
    form.set("photoConsent", consent ? "yes" : "");
    form.set("identityPhoto", new File([photoBlob], photoName, { type: photoBlob.type || "image/jpeg" }));
    const response = await fetch("/api/auth/register", { method: "POST", body: form });
    if (response.redirected) {
      window.location.href = response.url;
      return;
    }
    const payload = await response.json().catch(() => ({}));
    setMessage(payload.error ?? "Registration failed.");
    setBusy(false);
  }

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
        {["Basic Info", "Identity Photo", "Confirm"].map((label, index) => (
          <div key={label} className={`rounded-full px-3 py-2 text-center ${step === index + 1 ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600"}`}>{index + 1}. {label}</div>
        ))}
      </div>

      <form ref={formRef} className={step === 1 ? "grid gap-4" : "hidden"}>
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <div className="grid gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" required autoComplete="name" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
        </div>
      </form>

      {step === 2 ? (
        <div className="grid gap-4">
          <div className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 md:grid-cols-2">
            <div>
              <p className="font-semibold">Profile photo guidance</p>
              <ul className="mt-2 list-disc pl-5">
                <li>Use good lighting and face the camera directly.</li>
                <li>Plain background preferred.</li>
                <li>Full face must be visible with no heavy filters or obstruction.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold">ID scan guidance</p>
              <ul className="mt-2 list-disc pl-5">
                <li>Place ID on a flat surface in bright light with no glare.</li>
                <li>Capture all corners and ensure sharp readable text.</li>
                <li>Use scan ID front/back when requested in verification.</li>
              </ul>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-3 rounded-xl border bg-slate-50 p-3">
              <video ref={videoRef} autoPlay playsInline muted className="aspect-square w-full rounded-xl bg-slate-900 object-cover" />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={startCamera}><Camera size={16} /> Take Photo</Button>
                <Button type="button" onClick={capturePhoto}>Use This Photo</Button>
              </div>
            </div>
            <div className="grid gap-3 rounded-xl border bg-slate-50 p-3">
              {photoPreview ? <img src={photoPreview} alt="Identity photo preview" className="mx-auto aspect-square w-44 rounded-full border-4 border-white object-cover shadow" /> : <div className="mx-auto flex aspect-square w-44 items-center justify-center rounded-full border bg-white text-sm text-slate-500">No photo</div>}
              <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={handleFile} className="rounded-md border bg-white px-3 py-2 text-sm" />
              <Button type="button" variant="outline" onClick={() => { setPhotoBlob(null); setPhotoPreview(""); startCamera(); }}><RotateCcw size={16} /> Retake</Button>
            </div>
          </div>
          <label className="flex gap-3 rounded-xl border bg-white p-3 text-sm">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>I consent to the use of my photo for identity verification and internal employment processing.</span>
          </label>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid gap-3 rounded-xl border bg-slate-50 p-4 text-sm">
          {photoPreview ? <img src={photoPreview} alt="Identity photo thumbnail" className="h-24 w-24 rounded-full object-cover" /> : null}
          <p className="font-semibold">Confirm and create your applicant account.</p>
          <p className="text-slate-600">Your photo is restricted to you and authorized HR/DON/Admin users. It is not used for facial recognition and is not shared externally.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {step > 1 ? <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>Back</Button> : null}
        {step < 3 ? <Button type="button" onClick={() => setStep(step + 1)}>Continue</Button> : <Button type="button" disabled={busy} onClick={createAccount}>{busy ? "Creating..." : "Create Applicant Account"}</Button>}
      </div>
      {message ? <p className="text-sm font-medium text-red-700">{message}</p> : null}
    </div>
  );
}
