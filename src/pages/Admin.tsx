import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AdmissionUploadTab from "@/components/admin/AdmissionUploadTab";
import AdmissionListTab from "@/components/admin/AdmissionListTab";
import AdmissionSummaryTab from "@/components/admin/AdmissionSummaryTab";
import LegacyDocUploadTab from "@/components/admin/LegacyDocUploadTab";

export default function Admin() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setAuthed(false);
      } else {
        setAuthed(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authed === null) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">인증 확인 중...</div>;
  }

  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">📄 전형안/요강 관리</h1>
        <button
          onClick={async () => { await supabase.auth.signOut(); setAuthed(false); }}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          로그아웃
        </button>
      </div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="upload" className="text-xs">📤 문서 업로드</TabsTrigger>
          <TabsTrigger value="list" className="text-xs">📋 업로드 현황</TabsTrigger>
          <TabsTrigger value="summary" className="text-xs">📊 대학별 현황</TabsTrigger>
          <TabsTrigger value="legacy" className="text-xs">📚 과목 안내서</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div className="bg-card border border-border rounded-2xl p-4 md:p-6">
            <AdmissionUploadTab />
          </div>
        </TabsContent>

        <TabsContent value="list">
          <div className="bg-card border border-border rounded-2xl p-4 md:p-6">
            <AdmissionListTab />
          </div>
        </TabsContent>

        <TabsContent value="summary">
          <div className="bg-card border border-border rounded-2xl p-4 md:p-6">
            <AdmissionSummaryTab />
          </div>
        </TabsContent>

        <TabsContent value="legacy">
          <div className="bg-card border border-border rounded-2xl p-4 md:p-6">
            <LegacyDocUploadTab />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      onLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form onSubmit={handleLogin} className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h2 className="text-lg font-bold text-center text-foreground">🔒 관리자 로그인</h2>
        {error && <p className="text-xs text-destructive text-center">{error}</p>}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
