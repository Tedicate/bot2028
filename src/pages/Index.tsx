import { motion } from "framer-motion";
import maintenanceChar from "@/assets/maintenance-character.png";

const Index = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background px-6 text-center">
      <motion.img
        src={maintenanceChar}
        alt="수리중 캐릭터"
        className="w-40 h-40 mb-8"
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      />
      <h1 className="text-2xl font-bold text-foreground mb-3">
        🔧 더 좋은 서비스를 위해 수리중입니다
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
        더 나은 모습으로 곧 돌아올게요!<br />
        조금만 기다려 주세요 🙏
      </p>
      <div className="mt-8 px-5 py-2.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
        열심히 공사중… 🚧
      </div>
    </div>
  );
};

export default Index;
