import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseChunk, type ParsedChunk } from "@/lib/parseChunk";

const EMBED_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-embed`;
const AUTH_HEADER = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

export default function AdmissionUploadTab() {
  const [text, setText] = useState("");
  const [sourceFile, setSourceFile] = useState("");
  const [preview, setPreview] = useState<ParsedChunk[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handlePreview = () => {
    const rawChunks = text.split("---CHUNK---").map((c) => c.trim()).filter(Boolean);
    const parsed = rawChunks.map(parseChunk).filter(Boolean) as ParsedChunk[];
    setPreview(parsed);
    setShowPreview(true);
    if (parsed.length === 0) {
      toast.error("파싱 가능한 청크가 없습니다. [META]...[/META] 형식을 확인하세요.");
    } else {
      toast.info(`총 ${parsed.length}개 청크 감지됨`);
    }
  };

  const handleUpload = async () => {
    if (preview.length === 0) {
      toast.error("먼저 미리보기로 청크를 파싱하세요");
      return;
    }

    setUploading(true);
    setProgress({ current: 0, total: preview.length });
    let success = 0;

    for (let i = 0; i < preview.length; i++) {
      setProgress({ current: i + 1, total: preview.length });
      const chunk = preview[i];

      try {
        // Embed
        const embedResp = await fetch(EMBED_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: AUTH_HEADER },
          body: JSON.stringify({ text: chunk.content, taskType: "RETRIEVAL_DOCUMENT" }),
        });

        if (!embedResp.ok) {
          toast.error(`청크 ${i + 1} 임베딩 실패`);
          await delay(100);
          continue;
        }

        const { embedding } = await embedResp.json();

        const { error } = await supabase.from("documents").insert({
          content: chunk.content,
          metadata: {
            university: chunk.university,
            year: chunk.year ?? 2026,
            document_type: chunk.document_type,
            admission_type: chunk.admission_type,
            content_type: chunk.content_type,
            source_file: sourceFile,
          },
          embedding: embedding as any,
        } as any);

        if (error) {
          console.error(`Chunk ${i + 1} insert error:`, error);
          toast.error(`청크 ${i + 1} 저장 실패`);
        } else {
          success++;
        }
      } catch (e) {
        console.error(`Chunk ${i + 1} error:`, e);
        toast.error(`청크 ${i + 1} 오류`);
      }

      await delay(100);
    }

    toast.success(`${success}/${preview.length} 청크 업로드 완료`);
    setUploading(false);
    setProgress({ current: 0, total: 0 });
    setText("");
    setPreview([]);
    setShowPreview(false);
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">원본 파일명 (source_file)</label>
        <Input
          value={sourceFile}
          onChange={(e) => setSourceFile(e.target.value)}
          placeholder="2026학년도_경희대_수시요강.pdf"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">마크다운 청크 입력</label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`[META]\nuniversity: 경희대\nyear: 2026\ndocument_type: 요강\nadmission_type: 학생부교과(지역균형)\ncontent_type: 지원자격\n[/META]\n\n여기에 청크 본문...\n\n---CHUNK---\n\n[META]\nuniversity: 경희대\n...\n[/META]\n\n다음 청크 본문...`}
          className="min-h-[400px] font-mono text-xs"
        />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={handlePreview} disabled={!text.trim()}>
          <Eye className="w-4 h-4 mr-2" />
          파싱 미리보기
        </Button>
        <Button onClick={handleUpload} disabled={uploading || preview.length === 0}>
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? "업로드 중..." : `업로드 (${preview.length}개)`}
        </Button>
      </div>

      {uploading && (
        <div>
          <Progress value={progressPercent} className="h-3 mb-1" />
          <p className="text-xs text-muted-foreground text-center">
            임베딩 중... {progress.current}/{progress.total} 완료
          </p>
        </div>
      )}

      {showPreview && preview.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            📋 총 {preview.length}개 청크 감지됨
          </p>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {preview.map((chunk, i) => (
              <Card key={i} className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="flex flex-wrap gap-1 mb-2">
                    <Badge variant="secondary">{chunk.university}</Badge>
                    <Badge variant="secondary">{chunk.year}</Badge>
                    <Badge variant="outline">{chunk.document_type}</Badge>
                    <Badge variant="outline">{chunk.admission_type}</Badge>
                    <Badge>{chunk.content_type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {chunk.content.slice(0, 100)}...
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
