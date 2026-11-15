import React, { useState } from 'react';
import {
  ArenaDatabase,
  MatchRecord,
  PlayMode,
  QuestionItem,
  SeasonConfig,
  StageConfig,
  StudentProfile,
  SubjectId,
} from '../game/types';
import {
  SUBJECT_NAMES,
  checkPlayerStageEligibility,
  getTaiwanDateString,
} from '../game/rules';
import { AVATAR_CATALOG, SUBJECT_METAS } from '../game/seedData';
import { ArenaWorldBackdrop, VoxelAvatar, VoxelSubjectIslandEmblem } from './VoxelGraphics';
import { soundEngine } from '../utils/sound';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ShieldCheck,
  Sparkles,
  Trophy,
  Home,
  Users,
} from 'lucide-react';

// ============================================================================
// 1. 玩家加入畫面 (雙方輸入號碼、顯示暱稱與角色再確認、禁止同號占用兩側)
// ============================================================================
export const PlayerJoinScreen: React.FC<{
  students: StudentProfile[];
  initialLeftNo: string;
  initialRightNo: string;
  touchMode: 'simultaneous' | 'turn_based';
  onChangeTouchMode: (m: 'simultaneous' | 'turn_based') => void;
  onBackHome: () => void;
  onConfirmPlayers: (left: StudentProfile, right: StudentProfile) => void;
}> = ({
  students,
  initialLeftNo,
  initialRightNo,
  touchMode,
  onChangeTouchMode,
  onBackHome,
  onConfirmPlayers,
}) => {
  const [leftCode, setLeftCode] = useState(initialLeftNo);
  const [rightCode, setRightCode] = useState(initialRightNo);
  const [leftConfirmed, setLeftConfirmed] = useState(false);
  const [rightConfirmed, setRightConfirmed] = useState(false);

  const findStudent = (code: string) => {
    const clean = code.trim().padStart(2, '0');
    return students.find((s) => s.number === clean && s.active) || null;
  };

  const leftStudent = findStudent(leftCode);
  const rightStudent = findStudent(rightCode);
  const isDuplicate =
    Boolean(leftStudent && rightStudent) && leftStudent?.number === rightStudent?.number;

  const handleDigit = (side: 'left' | 'right', digit: string) => {
    soundEngine.playClick();
    if (side === 'left') {
      setLeftConfirmed(false);
      setLeftCode((prev) => (prev.length >= 2 ? digit : prev + digit));
    } else {
      setRightConfirmed(false);
      setRightCode((prev) => (prev.length >= 2 ? digit : prev + digit));
    }
  };

  const handleClear = (side: 'left' | 'right') => {
    soundEngine.playClick(0.85);
    if (side === 'left') {
      setLeftConfirmed(false);
      setLeftCode('');
    } else {
      setRightConfirmed(false);
      setRightCode('');
    }
  };

  const renderSidePad = (
    side: 'left' | 'right',
    code: string,
    student: StudentProfile | null,
    confirmed: boolean,
    setConfirmed: (val: boolean) => void
  ) => {
    const isLeft = side === 'left';
    return (
      <div
        aria-label={isLeft ? '左側1P玩家號碼輸入區' : '右側2P玩家號碼輸入區'}
        className={`flex flex-col justify-between rounded-2xl bg-[#0B1D36] border-2 ${
          isLeft ? 'border-sky-400/70' : 'border-orange-400/70'
        } p-5 shadow-xl`}
      >
        <div>
          <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
            <span
              className={`text-lg font-black ${
                isLeft ? 'text-sky-300' : 'text-orange-300'
              }`}
            >
              {isLeft ? '左側玩家 (1P)' : '右側玩家 (2P)'}
            </span>
            <span className="text-xs text-slate-300">請輸入 2 位數固定座號 (01~28)</span>
          </div>

          {/* 角色與身分顯示卡 */}
          <div className="p-4 rounded-xl bg-[#071324] border border-sky-500/30 min-h-[120px] flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3.5">
              {student ? (
                <>
                  <VoxelAvatar
                    avatarId={student.avatarId}
                    size={72}
                    badgeNumber={student.number}
                  />
                  <div>
                    <div className="text-xs text-sky-300 font-bold">
                      {AVATAR_CATALOG[student.avatarId]?.name}
                    </div>
                    <div className="text-2xl font-black text-white mt-0.5">
                      {student.number}號 · {student.nickname}
                    </div>
                    <div className="text-xs text-slate-300 mt-1">
                      請確認是否為本人暱稱與角色
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-slate-400 text-sm py-4">
                  尚未找到對應座號（請輸入 01 ～ {students.length.toString().padStart(2, '0')}）
                </div>
              )}
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs text-slate-400">輸入座號</div>
              <div className="text-4xl font-mono font-black text-amber-400 tabular-nums">
                {code || '--'}
              </div>
            </div>
          </div>
        </div>

        {/* 中下方大按鈕數字鍵盤 */}
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(side, d)}
                className="h-12 rounded-xl bg-[#102A4C] hover:bg-[#163763] active:scale-95 border border-sky-400/40 text-white font-mono font-black text-xl cursor-pointer"
              >
                {d}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleClear(side)}
              className="px-4 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm cursor-pointer"
            >
              重設號碼
            </button>

            <button
              type="button"
              disabled={!student || isDuplicate}
              onClick={() => {
                soundEngine.playClick(1.1);
                setConfirmed(!confirmed);
              }}
              className={`flex-1 py-3.5 px-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                confirmed
                  ? 'bg-sky-400 text-slate-950'
                  : 'bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {confirmed
                  ? `已確認：${student?.nickname}`
                  : student
                  ? `確認我是 ${student.nickname}`
                  : '請先輸入有效座號'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen bg-[#061224] text-white flex flex-col justify-between p-4 md:p-6">
      <ArenaWorldBackdrop dimmed={true} />
      {/* 頂部導覽列 */}
      <div className="relative z-10 max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-sky-400/30">
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onBackHome();
          }}
          className="arena-navy-pill px-4 py-2.5 rounded-full text-sm font-black flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> 返回首頁
        </button>

        <div className="text-center">
          <h1 className="arena-title-stroke text-xl md:text-2xl font-black tracking-wide">
            步驟 1 / 3：雙方輸入個人號碼與身分確認
          </h1>
        </div>

        {/* 電子白板觸控模式切換（雙人同時觸控 vs 輪流作答模式） */}
        <div className="flex items-center gap-1.5 bg-[#0B1D36] p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onChangeTouchMode('simultaneous');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer ${
              touchMode === 'simultaneous'
                ? 'bg-sky-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            雙人同時觸控
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onChangeTouchMode('turn_based');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer ${
              touchMode === 'turn_based'
                ? 'bg-orange-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            輪流作答模式
          </button>
        </div>
      </div>

      {/* 重複號碼警告 */}
      {isDuplicate && (
        <div
          role="alert"
          className="max-w-3xl w-full mx-auto my-2 p-3 rounded-xl bg-orange-950 border-2 border-orange-400 text-orange-200 flex items-center justify-center gap-2 font-black text-sm"
        >
          <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
          <span>同一號碼（{leftStudent?.number}號）不能同時占用左右兩側！請輸入兩位不同同學的座號。</span>
        </div>
      )}

      {/* 左右分區輸入面板 */}
      <div className="relative z-10 max-w-6xl w-full mx-auto my-auto grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
        {renderSidePad('left', leftCode, leftStudent, leftConfirmed, setLeftConfirmed)}
        {renderSidePad('right', rightCode, rightStudent, rightConfirmed, setRightConfirmed)}
      </div>

      {/* 底部下一步主按鈕 */}
      <div className="relative z-10 max-w-6xl w-full mx-auto pt-3 border-t border-sky-400/30 flex items-center justify-between gap-4">
        <div className="text-xs text-sky-200 font-bold flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span>雙方確認本人暱稱與角色後，即可進入「選科與選關」</span>
        </div>

        <button
          type="button"
          disabled={!leftStudent || !rightStudent || isDuplicate || !leftConfirmed || !rightConfirmed}
          onClick={() => {
            if (leftStudent && rightStudent && !isDuplicate) {
              soundEngine.playFanfare();
              onConfirmPlayers(leftStudent, rightStudent);
            }
          }}
          className="arena-orange-cta px-8 py-4 rounded-2xl disabled:opacity-40 text-white font-black text-xl flex items-center gap-3 cursor-pointer"
        >
          <span>下一步：選擇科目與關卡</span>
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 2. 選科與選關畫面 (顯示雙方今日關卡鎖定狀態，一方已玩過則鎖定並提示改選)
// ============================================================================
export const SubjectAndStageScreen: React.FC<{
  db: ArenaDatabase;
  season: SeasonConfig;
  leftStudent: StudentProfile;
  rightStudent: StudentProfile;
  selectedSubject: SubjectId;
  onSelectSubject: (s: SubjectId) => void;
  selectedStageId: string;
  onSelectStage: (stageId: string) => void;
  onBack: () => void;
  onNextToModeConfirm: (stage: StageConfig) => void;
}> = ({
  db,
  season,
  leftStudent,
  rightStudent,
  selectedSubject,
  onSelectSubject,
  selectedStageId,
  onSelectStage,
  onBack,
  onNextToModeConfirm,
}) => {
  const todayTaiwan = getTaiwanDateString();
  const subjectStages = db.stages.filter((st) => st.subjectId === selectedSubject);
  const currentStage =
    subjectStages.find((st) => st.id === selectedStageId) || subjectStages[0];

  const leftElig = checkPlayerStageEligibility(
    leftStudent.number,
    selectedSubject,
    currentStage,
    todayTaiwan,
    season,
    db.matches
  );
  const rightElig = checkPlayerStageEligibility(
    rightStudent.number,
    selectedSubject,
    currentStage,
    todayTaiwan,
    season,
    db.matches
  );

  const bothCanPlayStage = leftElig.canPlayStageToday && rightElig.canPlayStageToday;

  return (
    <div className="relative min-h-screen bg-[#061224] text-white flex flex-col justify-between p-4 md:p-6">
      <ArenaWorldBackdrop dimmed={true} />

      <div className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between pb-3 border-b border-sky-400/30">
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onBack();
          }}
          className="arena-navy-pill px-4 py-2.5 rounded-full text-sm font-black flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> 返回重新輸入號碼
        </button>

        <h1 className="arena-title-stroke text-xl md:text-2xl font-black tracking-wide">
          步驟 2 / 3：選擇同一科目與關卡
        </h1>

        <div className="text-xs font-mono text-sky-300">
          臺灣日期：{todayTaiwan}（凌晨0點更新每日關卡）
        </div>
      </div>

      <div className="relative z-10 max-w-6xl w-full mx-auto my-auto space-y-5 py-4">
        {/* 五大領域 3D 浮空島與深藍底白粗體大字選擇列 */}
        <div>
          <div className="text-xs font-bold text-sky-300 mb-2">1. 請選擇對決領域：</div>
          <div className="grid grid-cols-5 gap-3">
            {SUBJECT_METAS.map((sub) => {
              const isSelected = selectedSubject === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onSelectSubject(sub.id);
                    const firstStage = db.stages.find((st) => st.subjectId === sub.id);
                    if (firstStage) onSelectStage(firstStage.id);
                  }}
                  className={`group flex flex-col items-center transition-transform cursor-pointer ${
                    isSelected ? 'scale-[1.03]' : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <VoxelSubjectIslandEmblem subjectId={sub.id} />
                  <div
                    className={`arena-subject-plaque w-full -mt-3 py-2.5 px-2 rounded-xl flex flex-col items-center justify-center ${
                      isSelected ? '!border-amber-400 shadow-[0_0_24px_rgba(249,115,22,0.65)]' : ''
                    }`}
                  >
                    <span className="arena-title-stroke text-2xl md:text-3xl font-black text-white tracking-wider">
                      {sub.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 關卡清單與雙方今日可玩資格檢查 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-2.5">
            <div className="text-xs font-bold text-sky-300">
              2. 請選擇「{SUBJECT_NAMES[selectedSubject]}」關卡（同一關卡每人每天限玩一次）：
            </div>
            {subjectStages.map((stage) => {
              const lCheck = checkPlayerStageEligibility(
                leftStudent.number,
                selectedSubject,
                stage,
                todayTaiwan,
                season,
                db.matches
              );
              const rCheck = checkPlayerStageEligibility(
                rightStudent.number,
                selectedSubject,
                stage,
                todayTaiwan,
                season,
                db.matches
              );
              const stagePlayable = lCheck.canPlayStageToday && rCheck.canPlayStageToday;
              const isPicked = currentStage.id === stage.id;

              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onSelectStage(stage.id);
                  }}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between gap-4 cursor-pointer ${
                    isPicked
                      ? 'bg-[#102A4C] border-orange-400 shadow-lg'
                      : 'bg-[#0B1D36] hover:bg-[#0F2442] border-sky-500/30'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-black text-sm text-amber-400">
                        [{stage.code}]
                      </span>
                      <span className="text-lg font-black text-white">{stage.name}</span>
                      <span className="text-xs text-sky-300">
                        · {stage.practiceOnly ? '僅限自由練習' : '可正式挑戰 / 自由練習'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{stage.description}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    {stagePlayable ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-black text-sky-300">
                        <CheckCircle2 className="w-5 h-5" /> 雙方今日皆可玩
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm font-black text-orange-400">
                        <Lock className="w-5 h-5" /> 今日已鎖定
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 右側：雙方資格即時檢查面板 */}
          <div className="p-5 rounded-2xl bg-[#0B1D36] border-2 border-sky-400/50 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <h3 className="text-base font-black text-sky-300 border-b border-slate-700 pb-2">
                所選關卡：{currentStage.code} · 雙方資格檢查
              </h3>

              <div className="p-3.5 rounded-xl bg-[#071324] border border-slate-800 space-y-1">
                <div className="font-black text-white">
                  1P 左側：{leftStudent.number}號 {leftStudent.nickname}
                </div>
                <div
                  className={`text-xs font-bold ${
                    leftElig.canPlayStageToday ? 'text-sky-300' : 'text-orange-400'
                  }`}
                >
                  {leftElig.canPlayStageToday
                    ? `今日尚未玩過本關 · 本季該科剩餘正式次數 ${leftElig.remainingOfficialInSeason} 次`
                    : leftElig.stageLockReason}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#071324] border border-slate-800 space-y-1">
                <div className="font-black text-white">
                  2P 右側：{rightStudent.number}號 {rightStudent.nickname}
                </div>
                <div
                  className={`text-xs font-bold ${
                    rightElig.canPlayStageToday ? 'text-sky-300' : 'text-orange-400'
                  }`}
                >
                  {rightElig.canPlayStageToday
                    ? `今日尚未玩過本關 · 本季該科剩餘正式次數 ${rightElig.remainingOfficialInSeason} 次`
                    : rightElig.stageLockReason}
                </div>
              </div>
            </div>

            {!bothCanPlayStage && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-orange-950/90 border border-orange-400 text-xs font-bold text-orange-200 leading-relaxed"
              >
                一方已於今天玩過所選關卡「{currentStage.code}」，依規定同一關每天只能玩一次，請改選雙方今天都能玩的關卡！
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部導覽 */}
      <div className="relative z-10 max-w-6xl w-full mx-auto pt-3 border-t border-sky-400/30 flex items-center justify-between">
        <div className="text-xs text-slate-200 font-bold">
          已選：{SUBJECT_NAMES[selectedSubject]} — {currentStage.name}
        </div>
        <button
          type="button"
          disabled={!bothCanPlayStage}
          onClick={() => {
            soundEngine.playClick(1.1);
            onNextToModeConfirm(currentStage);
          }}
          className="arena-orange-cta px-8 py-4 rounded-2xl disabled:opacity-40 text-white font-black text-xl flex items-center gap-3 cursor-pointer"
        >
          <span>下一步：確認正式／練習模式</span>
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 3. 模式確認與雙方準備畫面 (雙方可選不同模式、顯示練習鎖定提醒、雙方準備後才扣次開賽)
// ============================================================================
export const ModeConfirmScreen: React.FC<{
  db: ArenaDatabase;
  season: SeasonConfig;
  subjectId: SubjectId;
  stage: StageConfig;
  leftStudent: StudentProfile;
  rightStudent: StudentProfile;
  drawError?: string;
  onBack: () => void;
  onStartBattle: (leftMode: PlayMode, rightMode: PlayMode) => void;
}> = ({
  db,
  season,
  subjectId,
  stage,
  leftStudent,
  rightStudent,
  drawError,
  onBack,
  onStartBattle,
}) => {
  const todayTaiwan = getTaiwanDateString();
  const leftElig = checkPlayerStageEligibility(
    leftStudent.number,
    subjectId,
    stage,
    todayTaiwan,
    season,
    db.matches
  );
  const rightElig = checkPlayerStageEligibility(
    rightStudent.number,
    subjectId,
    stage,
    todayTaiwan,
    season,
    db.matches
  );

  const [leftMode, setLeftMode] = useState<PlayMode>(
    leftElig.canPlayOfficial ? 'official' : 'practice'
  );
  const [rightMode, setRightMode] = useState<PlayMode>(
    rightElig.canPlayOfficial ? 'official' : 'practice'
  );
  const [leftReady, setLeftReady] = useState(false);
  const [rightReady, setRightReady] = useState(false);

  const renderModeCard = (
    side: 'left' | 'right',
    student: StudentProfile,
    elig: typeof leftElig,
    mode: PlayMode,
    setMode: (m: PlayMode) => void,
    ready: boolean,
    setReady: (r: boolean) => void
  ) => {
    const isLeft = side === 'left';
    return (
      <div
        aria-label={isLeft ? '左側玩家模式確認區' : '右側玩家模式確認區'}
        className={`rounded-2xl bg-[#0B1D36] border-2 ${
          isLeft ? 'border-sky-400/70' : 'border-orange-400/70'
        } p-5 flex flex-col justify-between space-y-4 shadow-xl`}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <div className="flex items-center gap-3">
              <VoxelAvatar avatarId={student.avatarId} size={54} badgeNumber={student.number} />
              <div>
                <div className="text-xl font-black text-white">
                  {student.number}號 · {student.nickname}
                </div>
                <div className="text-xs text-sky-300 font-bold">
                  本季{SUBJECT_NAMES[subjectId]}剩餘正式機會：{elig.remainingOfficialInSeason} /{' '}
                  {season.rules.seasonMaxOfficialPerSubject} 次
                </div>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-300">
              今日已用正式：{elig.usedOfficialTodayInSubject}/1
            </span>
          </div>

          <div className="text-xs font-bold text-sky-200">
            請選擇本場參賽模式（雙方可使用不同模式）：
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!elig.canPlayOfficial}
              onClick={() => {
                soundEngine.playClick();
                setMode('official');
                setReady(false);
              }}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                mode === 'official'
                  ? 'bg-orange-500 border-amber-200 text-slate-950 font-black'
                  : 'bg-[#102A4C] border-sky-400/40 text-white disabled:opacity-40'
              }`}
            >
              <div className="flex items-center gap-1.5 text-base font-black">
                <ShieldCheck className="w-5 h-5" />
                <span>正式挑戰</span>
              </div>
              <div className="text-xs mt-1 opacity-90">
                計入兩週賽季最高分排名（每科最多3次，同科每日限1次）
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setMode('practice');
                setReady(false);
              }}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                mode === 'practice'
                  ? 'bg-sky-400 border-sky-200 text-slate-950 font-black'
                  : 'bg-[#102A4C] border-sky-400/40 text-white'
              }`}
            >
              <div className="flex items-center gap-1.5 text-base font-black">
                <Sparkles className="w-5 h-5" />
                <span>自由練習</span>
              </div>
              <div className="text-xs mt-1 opacity-90">
                複習與加強，保存學習紀錄但不影響賽季排名
              </div>
            </button>
          </div>

          {!elig.canPlayOfficial && elig.officialBlockReason && (
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-amber-300">
              正式挑戰鎖定原因：{elig.officialBlockReason}
            </div>
          )}

          {/* 規格指定提醒：如果當天先練習某關，就不能再正式玩同一關 */}
          <div className="p-3 rounded-xl bg-[#071324] border border-amber-400/50 text-xs text-amber-200 leading-relaxed flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{elig.practiceLocksOfficialWarning}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick(1.1);
            setReady(!ready);
          }}
          className={`w-full py-4 rounded-xl font-black text-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer ${
            ready
              ? 'bg-sky-400 text-slate-950'
              : 'bg-orange-500 hover:bg-orange-400 text-slate-950'
          }`}
        >
          <CheckCircle2 className="w-6 h-6" />
          <span>
            {ready
              ? `已準備就緒（${mode === 'official' ? '正式挑戰' : '自由練習'}）`
              : `點此準備（以「${mode === 'official' ? '正式挑戰' : '自由練習'}」出賽）`}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen bg-[#061224] text-white flex flex-col justify-between p-4 md:p-6">
      <ArenaWorldBackdrop dimmed={true} />
      <div className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between pb-3 border-b border-sky-400/30">
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onBack();
          }}
          className="arena-navy-pill px-4 py-2.5 rounded-full text-sm font-black flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> 返回重選關卡
        </button>

        <div className="text-center">
          <h1 className="arena-title-stroke text-xl md:text-2xl font-black">
            步驟 3 / 3：確認參賽模式與雙方準備
          </h1>
          <p className="text-xs text-sky-300">
            科目：{SUBJECT_NAMES[subjectId]} · 關卡：{stage.code}（{stage.name}）
          </p>
        </div>

        <div className="text-xs text-amber-300 font-bold">
          雙方確認開賽後才占用今日關卡機會
        </div>
      </div>

      {drawError && (
        <div
          role="alert"
          className="relative z-10 max-w-4xl w-full mx-auto my-2 p-4 rounded-xl bg-orange-950 border-2 border-orange-400 text-orange-200 text-sm font-black"
        >
          {drawError}
        </div>
      )}

      <div className="relative z-10 max-w-6xl w-full mx-auto my-auto grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
        {renderModeCard(
          'left',
          leftStudent,
          leftElig,
          leftMode,
          setLeftMode,
          leftReady,
          setLeftReady
        )}
        {renderModeCard(
          'right',
          rightStudent,
          rightElig,
          rightMode,
          setRightMode,
          rightReady,
          setRightReady
        )}
      </div>

      <div className="relative z-10 max-w-6xl w-full mx-auto pt-3 border-t border-sky-400/30 flex items-center justify-between">
        <div className="text-xs text-slate-200 font-bold">
          左方：{leftStudent.nickname}（{leftMode === 'official' ? '正式挑戰' : '自由練習'}） vs 右方：
          {rightStudent.nickname}（{rightMode === 'official' ? '正式挑戰' : '自由練習'}）
        </div>

        <button
          type="button"
          disabled={!leftReady || !rightReady}
          onClick={() => {
            soundEngine.playFanfare();
            onStartBattle(leftMode, rightMode);
          }}
          className="arena-orange-cta px-10 py-4 rounded-2xl disabled:opacity-40 text-white font-black text-2xl flex items-center gap-3 cursor-pointer"
        >
          <span>雙方準備完成 · 正式開賽！</span>
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 4. 對戰結果與解析畫面 (勝負、分數、最高分更新、剩餘次數、逐題解析、提醒讓下一組遊玩)
// ============================================================================
export const MatchResultScreen: React.FC<{
  match: MatchRecord;
  leftQuestions: QuestionItem[];
  rightQuestions: QuestionItem[];
  db: ArenaDatabase;
  season: SeasonConfig;
  onReturnHome: () => void;
}> = ({ match, leftQuestions, rightQuestions, db, season, onReturnHome }) => {
  const todayTaiwan = getTaiwanDateString();
  const stageObj =
    db.stages.find((s) => s.id === match.stageId) || db.stages[0];

  const leftAfterElig = checkPlayerStageEligibility(
    match.playerLeft.studentNumber,
    match.subjectId,
    stageObj,
    todayTaiwan,
    season,
    db.matches
  );
  const rightAfterElig = checkPlayerStageEligibility(
    match.playerRight.studentNumber,
    match.subjectId,
    stageObj,
    todayTaiwan,
    season,
    db.matches
  );

  const renderPlayerSummary = (
    side: 'left' | 'right',
    player: MatchRecord['playerLeft'],
    questions: QuestionItem[],
    remainingOfficial: number,
    isWinner: boolean
  ) => (
    <div
      className={`rounded-2xl bg-[#0B1D36] border-2 ${
        isWinner ? 'border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.3)]' : 'border-sky-400/40'
      } p-5 flex flex-col justify-between space-y-4`}
    >
      <div>
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-3">
            <VoxelAvatar
              avatarId={player.avatarId}
              size={58}
              badgeNumber={player.studentNumber}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-white">
                  {player.studentNumber}號 {player.nickname}
                </span>
                {isWinner && (
                  <span className="text-xs font-black text-amber-300 flex items-center gap-1">
                    <Trophy className="w-4 h-4" /> 本場獲勝
                  </span>
                )}
              </div>
              <div className="text-xs text-sky-300 font-bold mt-0.5">
                模式：{player.mode === 'official' ? '正式挑戰（計入賽季最高分）' : '自由練習（不影響排名）'} · 該科本季剩餘正式機會：{remainingOfficial} 次
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-300">本場得分</div>
            <div className="text-4xl font-mono font-black text-amber-400 tabular-nums">
              {player.score}
            </div>
          </div>
        </div>

        {/* 逐題作答與解析回顧 */}
        <div className="mt-3 space-y-2 max-h-[340px] overflow-y-auto pr-1">
          <div className="text-xs font-bold text-sky-300">逐題作答紀錄與解析：</div>
          {questions.map((q, idx) => {
            const ansLog = player.answers[idx];
            const isCorrect = ansLog?.isCorrect;
            return (
              <div
                key={`${side}-${q.id}`}
                className="p-3 rounded-xl bg-[#071324] border border-slate-800 text-xs space-y-1"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-white">
                    Q{idx + 1}. [{q.contentType}] {q.stem}
                  </span>
                  <span className={isCorrect ? 'text-sky-300 shrink-0' : 'text-orange-400 shrink-0'}>
                    {isCorrect ? '✔ 答對 (+20)' : '✘ 答錯 (+0)'}
                  </span>
                </div>
                <div className="text-slate-300">
                  你的作答：<span className="font-mono text-white">{ansLog?.submittedAnswer || '--'}</span> · 正確答案：
                  <span className="font-mono text-amber-300">{q.correctAnswer}</span>
                </div>
                <div className="text-slate-400">解析：{q.explanation}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#061224] text-white flex flex-col justify-between p-4 md:p-6">
      <div className="max-w-6xl w-full mx-auto text-center space-y-1 pb-3 border-b border-slate-800">
        <div className="text-xs font-bold text-sky-300">
          {SUBJECT_NAMES[match.subjectId]} · {match.stageName} · 雙人對決結果
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-amber-400">
          {match.winner === 'draw'
            ? `雙方平手！（${match.playerLeft.score} : ${match.playerRight.score}）`
            : match.winner === 'left'
            ? `恭喜 ${match.playerLeft.studentNumber}號 ${match.playerLeft.nickname} 獲勝！`
            : `恭喜 ${match.playerRight.studentNumber}號 ${match.playerRight.nickname} 獲勝！`}
        </h1>
      </div>

      <div className="max-w-6xl w-full mx-auto my-auto grid grid-cols-1 md:grid-cols-2 gap-5 py-4">
        {renderPlayerSummary(
          'left',
          match.playerLeft,
          leftQuestions,
          leftAfterElig.remainingOfficialInSeason,
          match.winner === 'left'
        )}
        {renderPlayerSummary(
          'right',
          match.playerRight,
          rightQuestions,
          rightAfterElig.remainingOfficialInSeason,
          match.winner === 'right'
        )}
      </div>

      {/* 規格指定：每局結束 回首頁，提醒讓下一組遊玩，不直接續局 */}
      <div className="max-w-6xl w-full mx-auto pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm font-bold text-sky-200">
          成績與學習紀錄已自動保存於伺服器！下課時間有限，請將電子白板禮讓給下一組同學遊玩。
        </div>
        <button
          type="button"
          data-start="true"
          onClick={() => {
            soundEngine.playClick();
            onReturnHome();
          }}
          className="px-8 py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-xl flex items-center gap-3 shadow-xl cursor-pointer whitespace-nowrap"
        >
          <Home className="w-6 h-6" />
          <span>返回首頁（請讓下一組同學遊玩）</span>
        </button>
      </div>
    </div>
  );
};
