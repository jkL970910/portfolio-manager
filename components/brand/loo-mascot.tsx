import { cn } from "@/lib/utils";

export type LooMood = "guide" | "smirk" | "side-eye" | "proud";

function getMoodConfig(mood: LooMood) {
  switch (mood) {
    case "smirk":
      return {
        leftEye: "M112 116 C126 110, 142 110, 154 117",
        rightEye: "M182 118 C198 112, 214 113, 226 121",
        mouth: "M142 178 C160 190, 188 188, 206 170",
        browLeft: "M108 96 L148 88",
        browRight: "M184 88 L224 94",
        bubble: "今天不乱买, 就已经很厉害了。"
      };
    case "side-eye":
      return {
        leftEye: "M108 122 C120 116, 138 116, 150 122",
        rightEye: "M184 118 C197 110, 214 112, 226 122",
        mouth: "M146 176 C164 170, 184 174, 202 184",
        browLeft: "M108 96 L148 102",
        browRight: "M188 88 L228 84",
        bubble: "这笔钱, 真的要现在冲进去吗?"
      };
    case "proud":
      return {
        leftEye: "M112 118 C126 114, 142 114, 154 120",
        rightEye: "M184 120 C198 114, 214 114, 226 118",
        mouth: "M140 172 C162 196, 190 196, 212 172",
        browLeft: "M112 94 L148 86",
        browRight: "M188 86 L224 94",
        bubble: "藏宝路线已经整理好了, 去看看。"
      };
    case "guide":
    default:
      return {
        leftEye: "M112 120 C126 114, 142 114, 154 120",
        rightEye: "M184 120 C198 114, 214 114, 226 120",
        mouth: "M144 176 C160 184, 176 186, 196 180",
        browLeft: "M112 96 L148 92",
        browRight: "M188 92 L224 96",
        bubble: "先把资产放进宝库, 我来帮你看路线。"
      };
  }
}

export function LooMascot({
  mood = "guide",
  className,
  showBubble = false,
  bubbleText,
  compact = false
}: {
  mood?: LooMood;
  className?: string;
  showBubble?: boolean;
  bubbleText?: string;
  compact?: boolean;
}) {
  const config = getMoodConfig(mood);
  const text = bubbleText ?? config.bubble;

  return (
    <div className={cn("relative inline-flex items-end", className)}>
      {showBubble ? (
        <div className="absolute -top-3 left-4 z-10 max-w-[220px] rounded-[22px] border border-white/60 bg-white/70 px-4 py-3 text-sm font-medium leading-6 text-[color:var(--foreground)] shadow-[var(--shadow-card)] backdrop-blur-xl">
          <div className="absolute -bottom-2 left-7 h-4 w-4 rotate-45 rounded-[4px] border-b border-r border-white/60 bg-white/72" />
          {text}
        </div>
      ) : null}
      <svg
        viewBox="0 0 320 320"
        role="img"
        aria-label="Loo mascot"
        className={cn(compact ? "h-40 w-40" : "h-56 w-56 sm:h-64 sm:w-64")}
      >
        <defs>
          <linearGradient id="loo-body" x1="68" y1="52" x2="248" y2="258" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffb4cb" />
            <stop offset="0.52" stopColor="#f38daf" />
            <stop offset="1" stopColor="#df7898" />
          </linearGradient>
          <linearGradient id="loo-tail" x1="238" y1="186" x2="296" y2="262" gradientUnits="userSpaceOnUse">
            <stop stopColor="#d48aa1" />
            <stop offset="1" stopColor="#ba667f" />
          </linearGradient>
          <radialGradient id="loo-belly" cx="0" cy="0" r="1" gradientTransform="translate(166 204) rotate(90) scale(62 48)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fff8fb" />
            <stop offset="1" stopColor="#ffe1ea" />
          </radialGradient>
        </defs>

        <g opacity="0.28">
          <ellipse cx="164" cy="284" rx="82" ry="18" fill="#d7bfd2" />
        </g>

        <path
          d="M236 180 C264 182 284 198 288 222 C292 244 276 263 254 268 C236 272 218 262 212 244 C205 223 213 197 236 180 Z"
          fill="url(#loo-tail)"
        />
        <path d="M235 198 C253 202 266 214 268 229" stroke="#f3d7e0" strokeWidth="7" strokeLinecap="round" opacity="0.62" />
        <path d="M228 215 C246 220 258 232 260 245" stroke="#f3d7e0" strokeWidth="7" strokeLinecap="round" opacity="0.48" />

        <circle cx="104" cy="76" r="14" fill="url(#loo-body)" />
        <circle cx="222" cy="74" r="13" fill="url(#loo-body)" />

        <path
          d="M160 46 C103 46 66 88 66 144 C66 174 77 201 95 220 C106 232 113 246 116 261 C118 271 126 278 137 280 H192 C203 278 211 271 213 261 C216 246 224 232 236 220 C255 201 266 173 266 142 C266 87 223 46 160 46 Z"
          fill="url(#loo-body)"
        />

        <ellipse cx="111" cy="161" rx="16" ry="13" fill="#f7a9be" opacity="0.58" />
        <ellipse cx="216" cy="165" rx="17" ry="13" fill="#f7a9be" opacity="0.5" />
        <path d="M122 188 C121 203 112 215 96 220" stroke="#cf7b97" strokeWidth="10" strokeLinecap="round" opacity="0.86" />
        <path d="M201 188 C202 203 210 215 226 220" stroke="#cf7b97" strokeWidth="10" strokeLinecap="round" opacity="0.86" />

        <ellipse cx="164" cy="205" rx="56" ry="62" fill="url(#loo-belly)" />

        <path d={config.browLeft} stroke="#3f2642" strokeWidth="9" strokeLinecap="round" />
        <path d={config.browRight} stroke="#3f2642" strokeWidth="9" strokeLinecap="round" />
        <path d={config.leftEye} stroke="#2f2134" strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d={config.rightEye} stroke="#2f2134" strokeWidth="9" strokeLinecap="round" fill="none" />

        <path
          d="M146 134 C154 126 168 124 178 128 C186 132 188 140 184 148 C178 157 160 160 148 152 C143 149 141 140 146 134 Z"
          fill="#6e2953"
        />

        <path d={config.mouth} stroke="#7b3558" strokeWidth="8" strokeLinecap="round" fill="none" />
        <rect x="164" y="176" width="14" height="16" rx="4" fill="#f8fbff" />

        <path d="M124 244 C136 233 150 226 164 226 C179 226 193 233 205 244" stroke="#cf7b97" strokeWidth="8" strokeLinecap="round" opacity="0.9" />

        <path d="M104 58 C96 56 88 60 85 68" stroke="#ffd9e6" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
        <circle cx="236" cy="118" r="5" fill="#fff5f9" opacity="0.82" />
      </svg>
    </div>
  );
}
