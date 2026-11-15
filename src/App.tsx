import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActiveMatchSession,
  ArenaDatabase,
  MatchRecord,
  PlayMode,
  StageConfig,
  StudentProfile,
  SubjectId,
} from './game/types';
import { createInitialDatabase } from './game/seedData';
import {
  SUBJECT_NAMES,
  calculateMatchScore,
  determineMatchWinner,
  drawMatchQuestionsForBothPlayers,
  evaluateAnswer,
  getTaiwanDateString,
} from './game/rules';
import { TitleScreen } from './components/TitleScreen';
import {
  PlayerJoinScreen,
  SubjectAndStageScreen,
  ModeConfirmScreen,
  MatchResultScreen,
} from './components/MatchFlowScreens';
import { QuestionArenaPanel } from './components/QuestionArenaPanel';
import {
  PersonalRecordModal,
  SeasonLeaderboardModal,
} from './components/RecordsAndLeaderboardModal';
import { TeacherAdminModal } from './components/TeacherAdminModal';
import { soundEngine } from './utils/sound';
import { Pause, Volume2, VolumeX, Home, Play } from 'lucide-react';

type FlowScreen =
  | 'HOME'
  | 'PLAYER_JOIN'
  | 'SUBJECT_STAGE'
  | 'MODE_CONFIRM'
  | 'PK_BATTLE'
  | 'RESULT';

const LOCAL_STORAGE_KEY = 'arena_509_db_v1';

export default function App() {
  const [db, setDb] = useState<ArenaDatabase>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as ArenaDatabase;
        if (parsed && Array.isArray(parsed.students) && Array.isArray(parsed.questions)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return createInitialDatabase();
  });

  const [screen, setScreen] = useState<FlowScreen>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'PLAYER_JOIN';
      }
    }
    return 'HOME';
  });

  // Pre-match flow selections
  const [leftStudent, setLeftStudent] = useState<StudentProfile>(() => db.students[5] || db.students[0]); // Default 06 吳語彤 (fresh today)
  const [rightStudent, setRightStudent] = useState<StudentProfile>(() => db.students[6] || db.students[1]); // Default 07 王柏翰 (fresh today)
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>('chinese');
  const [selectedStageId, setSelectedStageId] = useState<string>('chinese-comp-01');
  const [touchMode, setTouchMode] = useState<'simultaneous' | 'turn_based'>('simultaneous');
  const [drawError, setDrawError] = useState<string | undefined>(undefined);
  const [completedMatch, setCompletedMatch] = useState<MatchRecord | null>(null);

  // Modals & overlays
  const [showPersonalRecord, setShowPersonalRecord] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showTeacherAdmin, setShowTeacherAdmin] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const [muted, setMuted] = useState(false);

  const questionStartTimeRef = useRef<{ left: number; right: number }>({
    left: Date.now(),
    right: Date.now(),
  });

  const activeSeason =
    db.seasons.find((s) => s.id === db.activeSeasonId) || db.seasons[0];

  // Sync state with server on load
  useEffect(() => {
    let mounted = true;
    fetch('/api/state')
      .then((r) => (r.ok ? r.json() : null))
      .then((serverDb: ArenaDatabase | null) => {
        if (!mounted || !serverDb || !Array.isArray(serverDb.students)) return;
        setDb(serverDb);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serverDb));
        // 若伺服器有進行中且未結束的場次，自動恢復原場（重新整理不重新抽題、不重複扣次）
        if (serverDb.activeSession) {
          setScreen('PK_BATTLE');
        }
      })
      .catch(() => {
        // Fallback to local state if offline
      });
    return () => {
      mounted = false;
    };
  }, []);

  const persistDbUpdate = useCallback((updater: (prev: ArenaDatabase) => ArenaDatabase) => {
    setDb((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch(() => {});
      return next;
    });
  }, []);

  const handleResetDemoDb = useCallback(() => {
    fetch('/api/reset', { method: 'POST' })
      .then((r) => r.json())
      .then((data: { state?: ArenaDatabase }) => {
        const fresh = data.state || createInitialDatabase();
        setDb(fresh);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fresh));
      })
      .catch(() => {
        const fresh = createInitialDatabase();
        setDb(fresh);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fresh));
      });
  }, []);

  // Mirror game state to document.body.dataset.state for testability
  useEffect(() => {
    if (isPaused) {
      document.body.dataset.state = 'paused';
    } else if (screen === 'HOME') {
      document.body.dataset.state = 'title';
    } else if (screen === 'RESULT') {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = 'playing';
    }
  }, [screen, isPaused]);

  // Keyboard shortcuts: Enter/Space on Title starts PK, Escape/P during PK toggles pause, M toggles mute
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (
        screen === 'HOME' &&
        !showPersonalRecord &&
        !showLeaderboard &&
        !showTeacherAdmin &&
        (e.key === 'Enter' || e.key === ' ')
      ) {
        e.preventDefault();
        soundEngine.playFanfare();
        setScreen('PLAYER_JOIN');
        return;
      }

      if (screen === 'PK_BATTLE' && (e.key === 'Escape' || e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      } else if (e.key.toLowerCase() === 'm') {
        const nextMute = soundEngine.toggleMute();
        setMuted(nextMute);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, showPersonalRecord, showLeaderboard, showTeacherAdmin]);

  // Idle timer during non-HOME screens: warn after 150s of inactivity
  useEffect(() => {
    if (screen === 'HOME') {
      setIdleWarning(false);
      return;
    }
    let timer = window.setTimeout(() => setIdleWarning(true), 150000);
    const resetTimer = () => {
      setIdleWarning(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdleWarning(true), 150000);
    };
    window.addEventListener('pointerdown', resetTimer);
    window.addEventListener('keydown', resetTimer);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [screen]);

  const handleStartPkFromTitle = (preselectedSubject?: SubjectId) => {
    if (preselectedSubject) {
      setSelectedSubject(preselectedSubject);
      const firstStage = db.stages.find((s) => s.subjectId === preselectedSubject);
      if (firstStage) setSelectedStageId(firstStage.id);
    }
    setScreen('PLAYER_JOIN');
  };

  const handleStartBattle = (leftMode: PlayMode, rightMode: PlayMode) => {
    const stageObj =
      db.stages.find((s) => s.id === selectedStageId) ||
      db.stages.find((s) => s.subjectId === selectedSubject) ||
      db.stages[0];

    const drawResult = drawMatchQuestionsForBothPlayers(
      selectedSubject,
      stageObj,
      leftStudent.number,
      rightStudent.number,
      leftMode,
      rightMode,
      activeSeason,
      db.questions,
      db.matches
    );

    if (!drawResult.ok) {
      soundEngine.playWrong();
      setDrawError(drawResult.errorReason);
      return;
    }

    setDrawError(undefined);
    const todayTaiwan = getTaiwanDateString();
    const matchId = `M-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();

    const newSession: ActiveMatchSession = {
      matchId,
      seasonId: activeSeason.id,
      dateTaiwan: todayTaiwan,
      startedAt: nowIso,
      subjectId: selectedSubject,
      stageId: stageObj.id,
      stageName: stageObj.code,
      touchMode,
      activeTurnSide: 'left',
      left: {
        student: leftStudent,
        mode: leftMode,
        questions: drawResult.leftQuestions,
        currentIndex: 0,
        answers: [],
        showingFeedback: false,
        finished: false,
      },
      right: {
        student: rightStudent,
        mode: rightMode,
        questions: drawResult.rightQuestions,
        currentIndex: 0,
        answers: [],
        showingFeedback: false,
        finished: false,
      },
    };

    // 雙方確認開賽後即建立進行中場次並保存於伺服器（重新整理不重新抽題、不重複扣次）
    const inProgressMatch: MatchRecord = {
      id: matchId,
      seasonId: activeSeason.id,
      dateTaiwan: todayTaiwan,
      startedAt: nowIso,
      subjectId: selectedSubject,
      stageId: stageObj.id,
      stageName: stageObj.code,
      touchMode,
      playerLeft: {
        studentNumber: leftStudent.number,
        nickname: leftStudent.nickname,
        avatarId: leftStudent.avatarId,
        mode: leftMode,
        questionIds: drawResult.leftQuestions.map((q) => q.id),
        answers: [],
        score: 0,
      },
      playerRight: {
        studentNumber: rightStudent.number,
        nickname: rightStudent.nickname,
        avatarId: rightStudent.avatarId,
        mode: rightMode,
        questionIds: drawResult.rightQuestions.map((q) => q.id),
        answers: [],
        score: 0,
      },
      winner: 'in_progress',
      voided: false,
    };

    questionStartTimeRef.current = { left: Date.now(), right: Date.now() };
    persistDbUpdate((prev) => ({
      ...prev,
      activeSession: newSession,
      matches: [inProgressMatch, ...prev.matches],
    }));
    setScreen('PK_BATTLE');
  };

  const handlePlayerSubmitAnswer = (side: 'left' | 'right', rawAnswer: string) => {
    const session = db.activeSession;
    if (!session) return;

    const playerState = session[side];
    if (playerState.showingFeedback || playerState.finished) return;

    const currentQ = playerState.questions[playerState.currentIndex];
    if (!currentQ) return;

    const isCorrect = evaluateAnswer(currentQ, rawAnswer, activeSeason.rules);
    if (isCorrect) {
      soundEngine.playCorrect();
    } else {
      soundEngine.playWrong();
    }

    const elapsed = Math.max(200, Date.now() - questionStartTimeRef.current[side]);
    const newLog = {
      questionId: currentQ.id,
      questionVersion: currentQ.version,
      submittedAnswer: rawAnswer,
      isCorrect,
      timeSpentMs: elapsed,
    };

    persistDbUpdate((prev) => {
      if (!prev.activeSession) return prev;
      const updatedSide = {
        ...prev.activeSession[side],
        answers: [...prev.activeSession[side].answers, newLog],
        showingFeedback: true,
        lastSubmittedAnswer: rawAnswer,
        lastIsCorrect: isCorrect,
      };
      return {
        ...prev,
        activeSession: {
          ...prev.activeSession,
          [side]: updatedSide,
        },
      };
    });
  };

  const handlePlayerNextQuestion = (side: 'left' | 'right') => {
    const session = db.activeSession;
    if (!session) return;

    questionStartTimeRef.current[side] = Date.now();

    persistDbUpdate((prev) => {
      const s = prev.activeSession;
      if (!s) return prev;

      const currentSide = s[side];
      const nextIdx = currentSide.currentIndex + 1;
      const isNowFinished = nextIdx >= currentSide.questions.length;

      const updatedSide = {
        ...currentSide,
        currentIndex: isNowFinished ? currentSide.currentIndex : nextIdx,
        showingFeedback: false,
        lastSubmittedAnswer: undefined,
        lastIsCorrect: undefined,
        finished: isNowFinished,
      };

      const otherSideKey = side === 'left' ? 'right' : 'left';
      const otherSide = s[otherSideKey];

      // 輪流作答模式下，每答完一題切換另一側（若另一側尚未完成）
      const nextActiveTurnSide =
        s.touchMode === 'turn_based'
          ? !otherSide.finished
            ? otherSideKey
            : side
          : s.activeTurnSide;

      const nextSession: ActiveMatchSession = {
        ...s,
        activeTurnSide: nextActiveTurnSide,
        [side]: updatedSide,
      };

      const leftScore = calculateMatchScore(
        nextSession.left.answers.filter((a) => a.isCorrect).length,
        nextSession.left.questions.length
      );
      const rightScore = calculateMatchScore(
        nextSession.right.answers.filter((a) => a.isCorrect).length,
        nextSession.right.questions.length
      );

      const bothFinished = nextSession.left.finished && nextSession.right.finished;
      const winner: MatchRecord['winner'] = bothFinished
        ? determineMatchWinner(leftScore, rightScore)
        : 'in_progress';
      const nowIso = new Date().toISOString();

      const updatedMatches: MatchRecord[] = prev.matches.map((m) => {
        if (m.id !== nextSession.matchId) return m;
        return {
          ...m,
          finishedAt: bothFinished ? nowIso : undefined,
          winner,
          playerLeft: {
            ...m.playerLeft,
            answers: nextSession.left.answers,
            score: leftScore,
            completedAt: nextSession.left.finished ? nowIso : undefined,
          },
          playerRight: {
            ...m.playerRight,
            answers: nextSession.right.answers,
            score: rightScore,
            completedAt: nextSession.right.finished ? nowIso : undefined,
          },
        };
      });

      if (bothFinished) {
        const finalMatch = updatedMatches.find((m) => m.id === nextSession.matchId) || null;
        setTimeout(() => {
          soundEngine.playFanfare();
          setCompletedMatch(finalMatch);
          setScreen('RESULT');
        }, 60);
      }

      return {
        ...prev,
        activeSession: bothFinished ? null : nextSession,
        matches: updatedMatches,
      };
    });
  };

  return (
    <main className="min-h-screen w-full bg-[#061224] text-white">
      {/* 1. 首頁 */}
      {screen === 'HOME' && (
        <TitleScreen
          season={activeSeason}
          muted={muted}
          onToggleMute={() => setMuted(soundEngine.toggleMute())}
          onStartPk={handleStartPkFromTitle}
          onOpenPersonalRecord={() => setShowPersonalRecord(true)}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
          onOpenTeacherAdmin={() => setShowTeacherAdmin(true)}
        />
      )}

      {/* 2. 玩家加入 */}
      {screen === 'PLAYER_JOIN' && (
        <PlayerJoinScreen
          students={db.students}
          initialLeftNo={leftStudent.number}
          initialRightNo={rightStudent.number}
          touchMode={touchMode}
          onChangeTouchMode={setTouchMode}
          onBackHome={() => setScreen('HOME')}
          onConfirmPlayers={(l, r) => {
            setLeftStudent(l);
            setRightStudent(r);
            setScreen('SUBJECT_STAGE');
          }}
        />
      )}

      {/* 3. 選科選關 */}
      {screen === 'SUBJECT_STAGE' && (
        <SubjectAndStageScreen
          db={db}
          season={activeSeason}
          leftStudent={leftStudent}
          rightStudent={rightStudent}
          selectedSubject={selectedSubject}
          onSelectSubject={setSelectedSubject}
          selectedStageId={selectedStageId}
          onSelectStage={setSelectedStageId}
          onBack={() => setScreen('PLAYER_JOIN')}
          onNextToModeConfirm={(stage: StageConfig) => {
            setSelectedStageId(stage.id);
            setDrawError(undefined);
            setScreen('MODE_CONFIRM');
          }}
        />
      )}

      {/* 4. 模式確認與雙方準備 */}
      {screen === 'MODE_CONFIRM' && (
        <ModeConfirmScreen
          db={db}
          season={activeSeason}
          subjectId={selectedSubject}
          stage={
            db.stages.find((s) => s.id === selectedStageId) ||
            db.stages.find((s) => s.subjectId === selectedSubject) ||
            db.stages[0]
          }
          leftStudent={leftStudent}
          rightStudent={rightStudent}
          drawError={drawError}
          onBack={() => setScreen('SUBJECT_STAGE')}
          onStartBattle={handleStartBattle}
        />
      )}

      {/* 5. PK作答頁 (簡潔、左右分區互不干擾、大按鈕集中中下方) */}
      {screen === 'PK_BATTLE' && db.activeSession && (
        <div className="min-h-screen flex flex-col justify-between p-3 md:p-5 bg-[#061224]">
          {/* 精簡頂部狀態列 */}
          <div className="max-w-[1400px] w-full mx-auto flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-lg bg-[#102A4C] border border-sky-400/50 text-sm font-black text-white">
                {SUBJECT_NAMES[db.activeSession.subjectId]} · {db.activeSession.stageName}
              </span>
              {db.activeSession.touchMode === 'turn_based' && (
                <span className="text-xs font-bold text-amber-300">
                  輪流作答模式：目前輪到{' '}
                  {db.activeSession.activeTurnSide === 'left'
                    ? `${db.activeSession.left.student.nickname} (左側)`
                    : `${db.activeSession.right.student.nickname} (右側)`}
                </span>
              )}
            </div>

            <div className="text-xs text-slate-300 hidden md:block">
              首次答對得分 · 答錯顯示答案與解析 · 不以速度決勝
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={muted ? '開啟音效' : '靜音'}
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setMuted(soundEngine.toggleMute());
                }}
                className="w-9 h-9 rounded-lg bg-[#0B1D36] border border-sky-400/40 flex items-center justify-center text-sky-300 cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4 text-orange-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                aria-label="暫停或離開"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setIsPaused(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#0B1D36] hover:bg-[#102A4C] border border-sky-400/40 text-xs font-bold text-sky-200 flex items-center gap-1 cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5" /> 暫停
              </button>
            </div>
          </div>

          {/* 左右分區獨立作答面板 */}
          <div className="max-w-[1400px] w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 py-3">
            <QuestionArenaPanel
              side="left"
              student={db.activeSession.left.student}
              mode={db.activeSession.left.mode}
              questions={db.activeSession.left.questions}
              currentIndex={db.activeSession.left.currentIndex}
              score={calculateMatchScore(
                db.activeSession.left.answers.filter((a) => a.isCorrect).length,
                db.activeSession.left.questions.length
              )}
              showingFeedback={db.activeSession.left.showingFeedback}
              lastSubmittedAnswer={db.activeSession.left.lastSubmittedAnswer}
              lastIsCorrect={db.activeSession.left.lastIsCorrect}
              finished={db.activeSession.left.finished}
              isTurnActive={
                db.activeSession.touchMode === 'simultaneous' ||
                db.activeSession.activeTurnSide === 'left'
              }
              onSubmitAnswer={(ans) => handlePlayerSubmitAnswer('left', ans)}
              onNextQuestion={() => handlePlayerNextQuestion('left')}
            />

            <QuestionArenaPanel
              side="right"
              student={db.activeSession.right.student}
              mode={db.activeSession.right.mode}
              questions={db.activeSession.right.questions}
              currentIndex={db.activeSession.right.currentIndex}
              score={calculateMatchScore(
                db.activeSession.right.answers.filter((a) => a.isCorrect).length,
                db.activeSession.right.questions.length
              )}
              showingFeedback={db.activeSession.right.showingFeedback}
              lastSubmittedAnswer={db.activeSession.right.lastSubmittedAnswer}
              lastIsCorrect={db.activeSession.right.lastIsCorrect}
              finished={db.activeSession.right.finished}
              isTurnActive={
                db.activeSession.touchMode === 'simultaneous' ||
                db.activeSession.activeTurnSide === 'right'
              }
              onSubmitAnswer={(ans) => handlePlayerSubmitAnswer('right', ans)}
              onNextQuestion={() => handlePlayerNextQuestion('right')}
            />
          </div>
        </div>
      )}

      {/* 6. 結果與解析畫面 */}
      {screen === 'RESULT' && completedMatch && (
        <MatchResultScreen
          match={completedMatch}
          leftQuestions={
            completedMatch.playerLeft.questionIds
              .map((id) => db.questions.find((q) => q.id === id))
              .filter((q): q is NonNullable<typeof q> => Boolean(q))
          }
          rightQuestions={
            completedMatch.playerRight.questionIds
              .map((id) => db.questions.find((q) => q.id === id))
              .filter((q): q is NonNullable<typeof q> => Boolean(q))
          }
          db={db}
          season={activeSeason}
          onReturnHome={() => {
            setCompletedMatch(null);
            setScreen('HOME');
          }}
        />
      )}

      {/* 暫停 / 閒置提示 Modal */}
      {(isPaused || idleWarning) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="對戰暫停選單"
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#0B1D36] border-2 border-sky-400 p-6 text-center space-y-4 shadow-2xl">
            <h2 className="text-2xl font-black text-white">
              {idleWarning ? '系統閒置提醒' : '對戰已暫停'}
            </h2>
            <p className="text-sm text-sky-200 leading-relaxed">
              {idleWarning
                ? '目前畫面已閒置一段時間。已作答資料皆已安全保存，請問要繼續作答還是返回首頁？'
                : '開賽後已占用本關今日機會，中途離開不會自動退還機會（若為電子白板設備異常，請老師至教師設定作廢並恢復機會）。'}
            </p>
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsPaused(false);
                  setIdleWarning(false);
                }}
                className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-5 h-5" /> 繼續雙人作答
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPaused(false);
                  setIdleWarning(false);
                  persistDbUpdate((prev) => ({
                    ...prev,
                    activeSession: null,
                  }));
                  setScreen('HOME');
                }}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" /> 結束本場並返回首頁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 個人戰績 Modal */}
      {showPersonalRecord && (
        <PersonalRecordModal db={db} onClose={() => setShowPersonalRecord(false)} />
      )}

      {/* 本季排行榜 Modal */}
      {showLeaderboard && (
        <SeasonLeaderboardModal db={db} onClose={() => setShowLeaderboard(false)} />
      )}

      {/* 教師後台 Modal */}
      {showTeacherAdmin && (
        <TeacherAdminModal
          db={db}
          onUpdateDb={persistDbUpdate}
          onResetDemoDb={handleResetDemoDb}
          onClose={() => setShowTeacherAdmin(false)}
        />
      )}
    </main>
  );
}
