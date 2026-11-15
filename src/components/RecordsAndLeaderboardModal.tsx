import React, { useMemo, useState } from 'react';
import { ArenaDatabase, SubjectId } from '../game/types';
import {
  SUBJECT_NAMES,
  SUBJECT_ORDER,
  computeSeasonLeaderboard,
  getTaiwanDateString,
} from '../game/rules';
import { VoxelAvatar } from './VoxelGraphics';
import { AVATAR_CATALOG } from '../game/seedData';
import { soundEngine } from '../utils/sound';
import { Trophy, Award, X, Calendar, CheckCircle2, Clock } from 'lucide-react';

export const PersonalRecordModal: React.FC<{
  db: ArenaDatabase;
  onClose: () => void;
}> = ({ db, onClose }) => {
  const [selectedNo, setSelectedNo] = useState<string>('01');
  const activeSeason =
    db.seasons.find((s) => s.id === db.activeSeasonId) || db.seasons[0];
  const todayTaiwan = getTaiwanDateString();

  const student =
    db.students.find((s) => s.number === selectedNo) || db.students[0];

  const stats = useMemo(() => {
    const validMatches = db.matches.filter(
      (m) => !m.voided && m.seasonId === activeSeason.id && m.winner !== 'in_progress'
    );

    const subjectStats = SUBJECT_ORDER.map((sub) => {
      let bestOfficial: number | null = null;
      let officialUsed = 0;
      let practiceUsed = 0;

      for (const m of validMatches) {
        if (m.subjectId !== sub) continue;
        const check = (side: typeof m.playerLeft) => {
          if (side.studentNumber !== student.number) return;
          if (side.mode === 'official') {
            officialUsed += 1;
            if (bestOfficial === null || side.score > bestOfficial) {
              bestOfficial = side.score;
            }
          } else {
            practiceUsed += 1;
          }
        };
        check(m.playerLeft);
        check(m.playerRight);
      }

      return {
        subjectId: sub,
        bestOfficial,
        officialUsed,
        officialRemaining: Math.max(
          0,
          activeSeason.rules.seasonMaxOfficialPerSubject - officialUsed
        ),
        practiceUsed,
      };
    });

    const completedCount = subjectStats.filter((s) => s.bestOfficial !== null).length;
    const totalScore = subjectStats.reduce((acc, s) => acc + (s.bestOfficial ?? 0), 0);

    const history = validMatches
      .filter(
        (m) =>
          m.playerLeft.studentNumber === student.number ||
          m.playerRight.studentNumber === student.number
      )
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

    const playedStagesToday = validMatches
      .filter(
        (m) =>
          m.dateTaiwan === todayTaiwan &&
          (m.playerLeft.studentNumber === student.number ||
            m.playerRight.studentNumber === student.number)
      )
      .map((m) => `${SUBJECT_NAMES[m.subjectId]} · ${m.stageName}`);

    return { subjectStats, completedCount, totalScore, history, playedStagesToday };
  }, [db.matches, activeSeason, student.number, todayTaiwan]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="個人戰績查詢"
      className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4 md:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-5xl bg-[#0B1D36] border-2 border-sky-400/60 rounded-2xl shadow-2xl text-white flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#071324] border-b border-sky-500/30">
          <div className="flex items-center gap-3">
            <Trophy className="w-7 h-7 text-amber-400" />
            <div>
              <h2 className="text-xl font-black tracking-wide">509班 · 個人戰績與學習紀錄</h2>
              <p className="text-xs text-sky-300">
                點選座號查看五科正式挑戰最高分、剩餘正式次數與歷次對戰紀錄
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center gap-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" /> 返回首頁
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 快速點選座號列 */}
          <div className="p-3.5 rounded-xl bg-[#071324] border border-slate-800">
            <div className="text-xs font-bold text-sky-300 mb-2">請點選你的座號：</div>
            <div className="flex flex-wrap gap-1.5">
              {db.students.map((stu) => (
                <button
                  key={stu.number}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setSelectedNo(stu.number);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-mono font-black text-xs transition-colors cursor-pointer ${
                    selectedNo === stu.number
                      ? 'bg-orange-500 text-slate-950'
                      : 'bg-[#102A4C] hover:bg-[#163763] text-white'
                  }`}
                >
                  {stu.number} {stu.nickname}
                </button>
              ))}
            </div>
          </div>

          {/* 學生戰績摘要卡 */}
          <div className="p-5 rounded-2xl bg-[#071324] border-2 border-sky-400/40 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <VoxelAvatar
                avatarId={student.avatarId}
                size={76}
                badgeNumber={student.number}
              />
              <div>
                <div className="text-2xl font-black text-white">
                  {student.number}號 · {student.nickname}
                </div>
                <div className="text-sm font-bold text-sky-300 mt-0.5">
                  角色稱號：{AVATAR_CATALOG[student.avatarId]?.name}（{AVATAR_CATALOG[student.avatarId]?.title}）
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  今日已玩關卡：
                  {stats.playedStagesToday.length > 0
                    ? stats.playedStagesToday.join('、')
                    : '今日尚未遊玩任何關卡'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs text-sky-300 font-bold">五科正式完成進度</div>
                <div className="text-2xl font-black font-mono tabular-nums text-white">
                  {stats.completedCount} / 5 科
                </div>
                <div className="text-[11px] text-amber-300">
                  {stats.completedCount === 5
                    ? '已取得本季總排名資格'
                    : `再完成 ${5 - stats.completedCount} 科即可列入總排名`}
                </div>
              </div>
              <div className="text-right pl-6 border-l border-slate-800">
                <div className="text-xs text-amber-300 font-bold">本季五科最高分加總</div>
                <div className="text-4xl font-black font-mono tabular-nums text-amber-400">
                  {stats.totalScore} <span className="text-base text-slate-400">/ 500</span>
                </div>
              </div>
            </div>
          </div>

          {/* 五大領域各科最高分與剩餘正式次數 */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {stats.subjectStats.map((sub) => (
              <div
                key={sub.subjectId}
                className="p-4 rounded-xl bg-[#102A4C] border border-sky-400/40 flex flex-col justify-between"
              >
                <div>
                  <div className="text-lg font-black text-white">
                    {SUBJECT_NAMES[sub.subjectId]}
                  </div>
                  <div className="text-xs text-sky-300 mt-0.5">
                    {sub.bestOfficial !== null ? '已完成正式挑戰' : '尚未正式挑戰'}
                  </div>
                </div>
                <div className="my-3">
                  <div className="text-xs text-slate-300">正式最高分</div>
                  <div className="text-3xl font-black font-mono tabular-nums text-amber-400">
                    {sub.bestOfficial !== null ? `${sub.bestOfficial}分` : '--'}
                  </div>
                </div>
                <div className="text-xs text-slate-200 pt-2 border-t border-sky-400/20 space-y-0.5">
                  <div>剩餘正式機會：{sub.officialRemaining} / 3 次</div>
                  <div className="text-slate-400">自由練習次數：{sub.practiceUsed} 次</div>
                </div>
              </div>
            ))}
          </div>

          {/* 歷次對戰紀錄 */}
          <div className="space-y-2">
            <h3 className="text-base font-black text-sky-300">
              本季歷次PK紀錄（共 {stats.history.length} 場）
            </h3>
            {stats.history.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#071324] border border-slate-800 text-center text-sm text-slate-400">
                目前尚無對戰紀錄，快回首頁點擊「開始雙人PK」挑戰吧！
              </div>
            ) : (
              <div className="space-y-2">
                {stats.history.map((m) => {
                  const isLeft = m.playerLeft.studentNumber === student.number;
                  const me = isLeft ? m.playerLeft : m.playerRight;
                  const opp = isLeft ? m.playerRight : m.playerLeft;
                  return (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-xl bg-[#071324] border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-slate-400">{m.dateTaiwan}</span>
                        <span className="font-black text-white">
                          {SUBJECT_NAMES[m.subjectId]} · {m.stageName}
                        </span>
                        <span className="text-xs text-sky-300 font-bold">
                          · {me.mode === 'official' ? '正式挑戰' : '自由練習'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 font-mono">
                        <span className="font-black text-amber-400 text-base tabular-nums">
                          得分：{me.score} 分
                        </span>
                        <span className="text-xs text-slate-300">
                          對手：{opp.studentNumber}號 {opp.nickname} ({opp.score}分)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const SeasonLeaderboardModal: React.FC<{
  db: ArenaDatabase;
  onClose: () => void;
}> = ({ db, onClose }) => {
  const [viewMode, setViewMode] = useState<'total' | 'in_progress' | SubjectId>('total');

  const activeSeason =
    db.seasons.find((s) => s.id === db.activeSeasonId) || db.seasons[0];

  const board = useMemo(
    () => computeSeasonLeaderboard(activeSeason, db.students, db.matches),
    [activeSeason, db.students, db.matches]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="本季排行榜"
      className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4 md:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-5xl bg-[#0B1D36] border-2 border-sky-400/60 rounded-2xl shadow-2xl text-white flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#071324] border-b border-sky-500/30">
          <div className="flex items-center gap-3">
            <Award className="w-7 h-7 text-amber-400" />
            <div>
              <h2 className="text-xl font-black tracking-wide">
                {activeSeason.name} · 賽季排行榜
              </h2>
              <p className="text-xs text-sky-300 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                賽季期間：{activeSeason.startDate} ～ {activeSeason.endDate} · 五科各完成至少1次正式挑戰即可列入五科總分排名（滿分500分，同分並列）
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center gap-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" /> 返回首頁
          </button>
        </div>

        {/* 排行榜分頁切換 */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-[#09172B] border-b border-slate-800">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setViewMode('total');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-black flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'total'
                ? 'bg-orange-500 text-slate-950'
                : 'bg-[#102A4C] text-sky-200 hover:bg-[#163763]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            五科總分榜 ({board.qualifiedRanked.length}人完賽)
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setViewMode('in_progress');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-black flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'in_progress'
                ? 'bg-orange-500 text-slate-950'
                : 'bg-[#102A4C] text-sky-200 hover:bg-[#163763]'
            }`}
          >
            <Clock className="w-4 h-4" />
            挑戰進行中 ({board.inProgressList.filter((x) => x.completedSubjectsCount > 0).length}人)
          </button>
          <div className="h-5 w-px bg-slate-700 mx-1" />
          {SUBJECT_ORDER.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setViewMode(sub);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer ${
                viewMode === sub
                  ? 'bg-sky-400 text-slate-950'
                  : 'bg-[#102A4C] text-white hover:bg-[#163763]'
              }`}
            >
              {SUBJECT_NAMES[sub]}單科榜
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'total' && (
            <div className="space-y-3">
              {board.qualifiedRanked.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#071324] border border-slate-800 text-center text-slate-300">
                  目前尚無學生完成全部五科正式挑戰，請切換至「挑戰進行中」查看各科進度！
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-sky-500/30">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#071324] text-sky-300 border-b border-slate-800">
                      <tr>
                        <th className="p-3.5">名次</th>
                        <th className="p-3.5">學生</th>
                        {SUBJECT_ORDER.map((sub) => (
                          <th key={sub} className="p-3.5 text-center">
                            {SUBJECT_NAMES[sub]}
                          </th>
                        ))}
                        <th className="p-3.5 text-right">五科總分</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {board.qualifiedRanked.map((entry) => (
                        <tr key={entry.studentNumber} className="hover:bg-[#102A4C]/50">
                          <td className="p-3.5 font-mono font-black text-xl text-amber-400 tabular-nums">
                            第 {entry.rank} 名
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <VoxelAvatar
                                avatarId={entry.avatarId}
                                size={42}
                                badgeNumber={entry.studentNumber}
                              />
                              <div>
                                <div className="font-black text-white text-base">
                                  {entry.studentNumber}號 {entry.nickname}
                                </div>
                                <div className="text-xs text-sky-300">五科正式挑戰已完成</div>
                              </div>
                            </div>
                          </td>
                          {SUBJECT_ORDER.map((sub) => (
                            <td
                              key={sub}
                              className="p-3.5 text-center font-mono font-bold text-base text-slate-200 tabular-nums"
                            >
                              {entry.subjectBestScores[sub]}
                            </td>
                          ))}
                          <td className="p-3.5 text-right font-mono font-black text-2xl text-amber-400 tabular-nums">
                            {entry.totalScore} <span className="text-xs text-slate-400">/ 500</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {viewMode === 'in_progress' && (
            <div className="space-y-3">
              <div className="text-xs text-sky-300 mb-2">
                以下為尚未完成全部五科正式挑戰的同學，完成全部五科各至少 1 次正式挑戰後將自動進入「五科總分榜」：
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#071324] text-slate-300 border-b border-slate-800">
                    <tr>
                      <th className="p-3">學生</th>
                      <th className="p-3">完成進度</th>
                      {SUBJECT_ORDER.map((sub) => (
                        <th key={sub} className="p-3 text-center">
                          {SUBJECT_NAMES[sub]}
                        </th>
                      ))}
                      <th className="p-3 text-right">目前累積分數</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {board.inProgressList.map((entry) => (
                      <tr key={entry.studentNumber} className="hover:bg-[#102A4C]/40">
                        <td className="p-3 font-bold">
                          {entry.studentNumber}號 {entry.nickname}
                        </td>
                        <td className="p-3 font-mono text-sky-300 font-bold tabular-nums">
                          已完成 {entry.completedSubjectsCount} / 5 科
                        </td>
                        {SUBJECT_ORDER.map((sub) => (
                          <td
                            key={sub}
                            className="p-3 text-center font-mono tabular-nums text-slate-300"
                          >
                            {entry.subjectBestScores[sub] ?? '--'}
                          </td>
                        ))}
                        <td className="p-3 text-right font-mono font-black text-lg text-amber-300 tabular-nums">
                          {entry.totalScore} 分
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewMode !== 'total' && viewMode !== 'in_progress' && (
            <div className="space-y-3">
              <h3 className="text-lg font-black text-sky-300">
                {SUBJECT_NAMES[viewMode]} · 單科正式挑戰最高分排名
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#071324] text-slate-300 border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">單科名次</th>
                      <th className="p-3.5">學生</th>
                      <th className="p-3.5">已挑戰正式次數</th>
                      <th className="p-3.5 text-right">本季單科最高分</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {board.bySubject[viewMode].map((row) => (
                      <tr key={row.studentNumber} className="hover:bg-[#102A4C]/40">
                        <td className="p-3.5 font-mono font-black text-lg text-amber-400 tabular-nums">
                          第 {row.rank} 名
                        </td>
                        <td className="p-3.5 font-bold">
                          {row.studentNumber}號 {row.nickname}
                        </td>
                        <td className="p-3.5 font-mono text-sky-300 tabular-nums">
                          {row.attempts} / 3 次
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-2xl text-amber-400 tabular-nums">
                          {row.bestScore} 分
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
