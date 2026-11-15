import React from 'react';
import { StudentProfile, SubjectId } from '../game/types';
import { AVATAR_CATALOG } from '../game/seedData';

export const REF_IMAGE_URL = `${import.meta.env.BASE_URL}assets/aistudio/S__118906889_77783138.jpg`;

/**
 * 3D方塊科技世界背景舞台：
 * 直接使用最新確認的方塊科技風參考圖 S__118906889_77783138.jpg
 * （人物、建築、浮空島、方塊雲朵與方形傳送門皆為一致方塊結構，且已具備深海軍藍、冰藍光、金屬銀、亮橘色配色）
 */
export const ArenaWorldBackdrop: React.FC<{
  dimmed?: boolean;
}> = ({ dimmed = false }) => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0 bg-[#061329]">
      <img
        src={REF_IMAGE_URL}
        alt=""
        referrerPolicy="no-referrer"
        className="w-full h-full object-fill"
        style={{
          filter: dimmed
            ? 'saturate(1.06) contrast(1.06) brightness(0.25)'
            : 'saturate(1.04) contrast(1.03)',
        }}
      />

      {dimmed && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 48%, rgba(8, 22, 46, 0.68) 0%, rgba(4, 11, 24, 0.92) 100%)',
          }}
        />
      )}
    </div>
  );
};

/**
 * 3D方塊科技學生頭像：
 * 取自最新方塊科技參考圖之 509 男女主角特寫，搭配金屬銀與冰藍光/亮橘色方塊邊框與座號銘牌
 */
export const VoxelAvatar: React.FC<{
  avatarId: StudentProfile['avatarId'];
  size?: number;
  facing?: 'left' | 'right';
  badgeNumber?: string;
}> = ({ avatarId, size = 72, badgeNumber = '509' }) => {
  const meta = AVATAR_CATALOG[avatarId] || AVATAR_CATALOG.azure_knight;
  const isGirlHero =
    avatarId === 'amber_ranger' || avatarId === 'ice_scholar' || avatarId === 'star_captain';

  const bgPos = isGirlHero ? '80.5% 60%' : '20.5% 58%';

  return (
    <div
      style={{ width: size, height: size, borderColor: meta.accentHex }}
      className="relative rounded-xl overflow-hidden border-2 bg-[#081833] shadow-[0_4px_14px_rgba(0,0,0,0.75)] shrink-0 select-none"
      aria-hidden="true"
    >
      <div
        className="w-full h-full bg-no-repeat"
        style={{
          backgroundImage: `url(${REF_IMAGE_URL})`,
          backgroundSize: '540% 360%',
          backgroundPosition: bgPos,
        }}
      />
      <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/35 pointer-events-none" />
      <div
        style={{ backgroundColor: '#061226', borderColor: meta.accentHex }}
        className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded border text-[11px] leading-none font-mono font-black text-white shadow"
      >
        {badgeNumber}
      </div>
    </div>
  );
};

/**
 * 五大領域 3D 方塊浮空島與方形傳送門特寫（供選科選關與內頁展示）
 */
export const VoxelSubjectIslandEmblem: React.FC<{
  subjectId: SubjectId;
}> = ({ subjectId }) => {
  const posMap: Record<SubjectId, string> = {
    chinese: '9.5% 24.5%',
    math: '30.5% 26.2%',
    social: '50% 26.5%',
    english: '70.5% 26.2%',
    life: '91% 24.5%',
  };

  return (
    <div
      className="relative w-full h-24 md:h-28 rounded-t-xl overflow-hidden border-2 border-b-0 border-sky-400/80 bg-[#081833] shadow-lg select-none"
      aria-hidden="true"
    >
      <div
        className="w-full h-full bg-no-repeat transition-transform duration-200 group-hover:scale-105"
        style={{
          backgroundImage: `url(${REF_IMAGE_URL})`,
          backgroundSize: '620% 740%',
          backgroundPosition: posMap[subjectId],
        }}
      />
      <div className="absolute inset-0 ring-1 ring-inset ring-white/25 pointer-events-none" />
    </div>
  );
};

export const QuestionDiagramGraphic: React.FC<{ imageFile?: string }> = ({ imageFile }) => {
  if (!imageFile) return null;

  if (imageFile === 'diagram_contour_peak') {
    return (
      <div className="my-2 p-3 rounded-xl bg-[#071326] border border-sky-400/50 flex items-center justify-center">
        <svg viewBox="0 0 320 130" className="w-full max-w-xs h-28" aria-label="等高線地形示意圖">
          <ellipse cx="160" cy="65" rx="130" ry="52" fill="none" stroke="#38BDF8" strokeWidth="2" />
          <text x="42" y="68" fill="#7DD3FC" fontSize="11" fontWeight="700">100m</text>
          <ellipse cx="160" cy="65" rx="90" ry="35" fill="none" stroke="#38BDF8" strokeWidth="2" />
          <text x="82" y="68" fill="#7DD3FC" fontSize="11" fontWeight="700">300m</text>
          <ellipse cx="160" cy="65" rx="46" ry="18" fill="#0EA5E9" fillOpacity="0.2" stroke="#F97316" strokeWidth="2.5" />
          <text x="145" y="69" fill="#FDBA74" fontSize="12" fontWeight="900">500m ▲</text>
        </svg>
      </div>
    );
  }

  if (imageFile === 'diagram_sun_shadow') {
    return (
      <div className="my-2 p-3 rounded-xl bg-[#071326] border border-sky-400/50 flex items-center justify-center">
        <svg viewBox="0 0 320 130" className="w-full max-w-xs h-28" aria-label="太陽位置與竿影觀測圖">
          <line x1="20" y1="102" x2="300" y2="102" stroke="#94A3B8" strokeWidth="3" />
          <text x="26" y="120" fill="#38BDF8" fontSize="13" fontWeight="900">西 (W)</text>
          <text x="250" y="120" fill="#F97316" fontSize="13" fontWeight="900">東 (E)</text>
          <circle cx="264" cy="34" r="16" fill="#F97316" stroke="#FDE68A" strokeWidth="3" />
          <line x1="244" y1="42" x2="160" y2="54" stroke="#FDBA74" strokeWidth="2" strokeDasharray="5 4" />
          <line x1="244" y1="42" x2="68" y2="102" stroke="#FDBA74" strokeWidth="2" strokeDasharray="5 4" />
          <rect x="157" y="52" width="6" height="50" fill="#F8FAFC" />
          <line x1="68" y1="100" x2="157" y2="100" stroke="#38BDF8" strokeWidth="6" />
          <text x="86" y="90" fill="#7DD3FC" fontSize="12" fontWeight="900">← 竿影方向？</text>
        </svg>
      </div>
    );
  }

  return (
    <div className="my-2 px-3 py-2 rounded-lg bg-[#0A192F] border border-sky-500/30 text-xs text-sky-200">
      圖示素材：{imageFile}
    </div>
  );
};
