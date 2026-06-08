"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Loader2, Upload } from "lucide-react";

type SettingsAudioUploadProps = {
  idPrefix: string;
  url: string;
  onUrlChange: (url: string) => void;
  placeholder: string;
  helpText: string;
  uploading: boolean;
  saving: boolean;
  onUpload: (file: File | null) => void;
  onSaveUrl: () => void;
};

export function SettingsAudioUpload({
  idPrefix,
  url,
  onUrlChange,
  placeholder,
  helpText,
  uploading,
  saving,
  onUpload,
  onSaveUrl,
}: SettingsAudioUploadProps) {
  const fileInputId = `${idPrefix}SoundFile`;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}AlertSoundUrl`} className="text-gray-900">
          Sound URL or path
        </Label>
        <Input
          id={`${idPrefix}AlertSoundUrl`}
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder={placeholder}
          className="bg-white text-gray-900 border-gray-300"
        />
        <p className="text-sm text-gray-700 leading-snug">{helpText}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-gray-200">
        <input
          type="file"
          accept="audio/*"
          className="hidden"
          id={fileInputId}
          onChange={(e) => onUpload(e.target.files?.[0] || null)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          className="border-gray-300 bg-white text-gray-900 hover:bg-gray-100"
          onClick={() => document.getElementById(fileInputId)?.click()}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          Upload audio file
        </Button>
        <Button type="button" onClick={onSaveUrl} disabled={saving}>
          Save URL
        </Button>
        <span className="text-sm text-gray-600">MP3, WAV, or other audio formats</span>
      </div>
    </div>
  );
}
