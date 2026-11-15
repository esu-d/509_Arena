import React from 'react';
import { SeasonConfig, SubjectId } from '../game/types';
import { SUBJECT_METAS } from '../game/seedData';
import { ArenaWorldBackdrop } from './VoxelGraphics';
import { soundEngine } from '../utils/sound';
import { Trophy, Settings, Calendar, Volume2, VolumeX } from 'lucide-react';

interface TitleScreenProps {
  season: SeasonConfig;
  muted: boolean;
  onToggleMute: () => void;
  onStartPk: (preselectedSubject?: SubjectId) => void;
  onOpenPersonalRecord: () => void;
  onOpenLeaderboard: () => void;
  onOpenTeacherAdmin: () => void;
}

// 對應 S__118906889_77783138.jpg 五座方塊浮空島與其銘牌的精準 1:1 座標
const ISLAND_SLOTS: Record<
  SubjectId,
  { left: string; width: string }
> = {
  chinese: { left: '7.8%', width: '14.4%' },
  math: { left: '27.6%', width: '12.5%' },
  social: { left: '43.8%', width: '13.4%' },
  english: { left: '62.0%', width: '12.5%' },
  life: { left: '79.2%', width: '15.6%' },
};

export const TitleScreen: React.FC<TitleScreenProps> = ({
  season,
  muted,
  onToggleMute,
  onStartPk,
  onOpenPersonalRecord,
  onOpenLeaderboard,
  onOpenTeacherAdmin,
}) => {
  return (
    <div className="relative w-full h-screen min-h-[680px] overflow-hidden bg-[#061329] text-white select-none">
      {/* 1. 最新確認版 3D 方塊科技浮空島、方形傳送門與雙主角世界舞台 */}
      <ArenaWorldBackdrop dimmed={false} />

      {/* 無障礙語意主標題 */}
      <h1 className="sr-only">509競技場 — 五大領域 · 雙人對決</h1>

      {/* 2. 右上角：程式獨立呈現之「兩週賽季」深海藍冰藍光膠囊按鈕 + 音效開關 */}
      <button
        type="button"
        aria-label={muted ? '開啟音效' : '靜音'}
        onClick={() => onToggleMute()}
        style={{
          left: '77.4%',
          top: '2.4%',
          height: '6.6%',
          aspectRatio: '1 / 1',
        }}
        className="arena-navy-pill absolute z-20 rounded-full flex items-center justify-center text-sky-200 cursor-pointer transition-transform active:scale-95"
      >
        {muted ? (
          <VolumeX className="w-5 h-5 text-orange-400" />
        ) : (
          <Volume2 className="w-5 h-5 text-sky-300" />
        )}
      </button>

      <button
        type="button"
        onClick={() => {
          soundEngine.playClick();
          onOpenLeaderboard();
        }}
        style={{
          left: '82.0%',
          width: '16.8%',
          top: '2.1%',
          height: '7.2%',
        }}
        className="arena-navy-pill absolute z-20 px-4 rounded-full flex items-center justify-center gap-2.5 text-lg md:text-2xl font-black text-white tracking-wider cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
      >
        <Calendar className="w-6 h-6 text-white shrink-0" />
        <span>兩週賽季</span>
      </button>

      {/* 3. 五座方塊浮空島互動熱區 + 規格指定「五科名稱放大版：深藍底、白色粗體大字，適合電子白板辨識」 */}
      {SUBJECT_METAS.map((sub) => {
        const slot = ISLAND_SLOTS[sub.id];
        return (
          <button
            key={sub.id}
            type="button"
            onClick={() => {
              soundEngine.playClick(1.08);
              onStartPk(sub.id);
            }}
            style={{
              left: slot.left,
              width: slot.width,
              top: '19.5%',
              height: '26.2%',
            }}
            className="group absolute z-20 flex flex-col justify-end items-center focus:outline-none cursor-pointer transition-transform duration-150 hover:-translate-y-1.5 active:scale-95"
          >
            {/* 浮空島建築與方形傳送門上半部透明觸控感應區 */}
            <div className="w-full flex-1 rounded-t-2xl group-hover:ring-2 group-hover:ring-sky-300/60 transition-all" />

            {/* 五科名稱放大版銘牌：保留參考圖兩側亮橘與金屬銀方塊側翼，中央採用深海軍藍底 + 白色粗體大字 */}
            <div className="arena-subject-plaque w-full h-[35%] min-h-[50px] px-2 rounded-xl flex items-center justify-center relative">
              {/* 左右亮橘色方塊側耳裝飾（呼應參考圖銘牌兩側橘色方塊結構） */}
              <span
                aria-hidden="true"
                className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-3/5 rounded-l bg-gradient-to-b from-amber-300 via-orange-500 to-amber-700 border border-amber-200"
              />
              <span
                aria-hidden="true"
                className="absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-3/5 rounded-r bg-gradient-to-b from-amber-300 via-orange-500 to-amber-700 border border-amber-200"
              />

              <span className="arena-title-stroke text-2xl sm:text-3xl md:text-[38px] leading-none font-black tracking-widest text-white whitespace-nowrap">
                {sub.name}
              </span>
            </div>
          </button>
        );
      })}

      {/* 4. 中央下方主按鈕：「開始雙人PK」（呼應參考圖之八角切角亮橘色3D方塊主按鈕） */}
      <div
        style={{
          left: '30.3%',
          width: '39.4%',
          top: '73.0%',
          height: '15.6%',
        }}
        className="absolute z-20 flex items-center justify-center"
      >
        <button
          type="button"
          data-start="true"
          onClick={() => {
            soundEngine.playFanfare();
            onStartPk();
          }}
          className="arena-orange-cta w-full h-full rounded-2xl flex items-center justify-center gap-4 md:gap-6 px-6 cursor-pointer transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
        >
          {/* 左側方塊像素光點（呼應參考圖主按鈕左右像素方塊） */}
          <span className="hidden sm:grid grid-cols-2 gap-1.5 shrink-0" aria-hidden="true">
            <span className="w-3.5 h-3.5 bg-amber-200/95 shadow-sm" />
            <span className="w-3.5 h-3.5 bg-amber-100/40" />
            <span className="w-3.5 h-3.5 bg-amber-100/40" />
            <span className="w-3.5 h-3.5 bg-amber-200/95 shadow-sm" />
          </span>

          <span className="arena-orange-text-stroke text-3xl sm:text-4xl md:text-[54px] font-black tracking-wider text-white whitespace-nowrap leading-none">
            開始雙人PK
          </span>

          {/* 右側方塊像素光點 */}
          <span className="hidden sm:grid grid-cols-2 gap-1.5 shrink-0" aria-hidden="true">
            <span className="w-3.5 h-3.5 bg-amber-100/40" />
            <span className="w-3.5 h-3.5 bg-amber-200/95 shadow-sm" />
            <span className="w-3.5 h-3.5 bg-amber-200/95 shadow-sm" />
            <span className="w-3.5 h-3.5 bg-amber-100/40" />
          </span>
        </button>
      </div>

      {/* 5. 底部三大功能按鈕：個人戰績、本季排行榜（含 2-1-3 頒獎台方塊圖示）、教師設定 */}
      <button
        type="button"
        onClick={() => {
          soundEngine.playClick();
          onOpenPersonalRecord();
        }}
        style={{
          left: '31.1%',
          width: '17.8%',
          top: '90.2%',
          height: '7.6%',
        }}
        className="arena-navy-pill absolute z-20 rounded-full flex items-center justify-center gap-2.5 px-4 text-lg md:text-2xl font-black text-white cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
      >
        <Trophy className="w-6 h-6 text-amber-400 shrink-0" />
        <span>個人戰績</span>
      </button>

      <button
        type="button"
        onClick={() => {
          soundEngine.playClick();
          onOpenLeaderboard();
        }}
        style={{
          left: '49.9%',
          width: '18.2%',
          top: '90.2%',
          height: '7.6%',
        }}
        className="arena-navy-pill absolute z-20 rounded-full flex items-center justify-center gap-2.5 px-4 text-lg md:text-2xl font-black text-white cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
      >
        {/* 呼應參考圖之 [2][1][3] 方塊頒獎台圖示 */}
        <svg viewBox="0 0 28 24" className="w-7 h-6 shrink-0" aria-hidden="true">
          <rect x="1" y="10" width="8" height="12" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1.2" />
          <text x="5" y="19" textAnchor="middle" fill="#0F172A" fontSize="8" fontWeight="900">2</text>
          <rect x="10" y="4" width="8" height="18" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.2" />
          <text x="14" y="15" textAnchor="middle" fill="#0F172A" fontSize="8.5" fontWeight="900">1</text>
          <rect x="19" y="12" width="8" height="10" fill="#CBD5E1" stroke="#0F172A" strokeWidth="1.2" />
          <text x="23" y="20" textAnchor="middle" fill="#0F172A" fontSize="7.5" fontWeight="900">3</text>
        </svg>
        <span>本季排行榜</span>
      </button>

      <button
        type="button"
        onClick={() => {
          soundEngine.playClick();
          onOpenTeacherAdmin();
        }}
        style={{
          left: '86.0%',
          width: '13.1%',
          top: '90.2%',
          height: '7.6%',
        }}
        className="arena-navy-pill absolute z-20 rounded-full flex items-center justify-center gap-2 px-4 text-base md:text-2xl font-black text-white cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
      >
        <Settings className="w-6 h-6 text-slate-200 shrink-0" />
        <span>教師設定</span>
      </button>
    </div>
  );
};
