import React, { useState } from 'react';
import {
  ArenaDatabase,
  QuestionItem,
  SeasonConfig,
  StudentProfile,
  SubjectId,
} from '../game/types';
import {
  SUBJECT_NAMES,
  SUBJECT_ORDER,
  validateAndParseQuestionCsv,
} from '../game/rules';
import { AVATAR_CATALOG } from '../game/seedData';
import { soundEngine } from '../utils/sound';
import {
  Lock,
  Users,
  BookOpen,
  Calendar,
  FileSpreadsheet,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';

interface TeacherAdminModalProps {
  db: ArenaDatabase;
  onUpdateDb: (updater: (prev: ArenaDatabase) => ArenaDatabase) => void;
  onResetDemoDb: () => void;
  onClose: () => void;
}

export const TeacherAdminModal: React.FC<TeacherAdminModalProps> = ({
  db,
  onUpdateDb,
  onResetDemoDb,
  onClose,
}) => {
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [activeTab, setActiveTab] = useState<'students' | 'questions' | 'season' | 'matches'>('questions');

  // Question tab state
  const [filterSubject, setFilterSubject] = useState<SubjectId | 'all'>('all');
  const [csvInput, setCsvInput] = useState('');
  const [csvResultMsg, setCsvResultMsg] = useState<{
    importedCount: number;
    errors: { rowNumber: number; message: string }[];
  } | null>(null);

  // AI textbook generator state
  const [aiSubject, setAiSubject] = useState<SubjectId>('chinese');
  const [aiUnit, setAiUnit] = useState('第一單元');
  const [aiMaterial, setAiMaterial] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  // New student state
  const [newStuNo, setNewStuNo] = useState('');
  const [newStuName, setNewStuName] = useState('');

  // Void reason state
  const [voidReasonMap, setVoidReasonMap] = useState<Record<string, string>>({});

  const activeSeason =
    db.seasons.find((s) => s.id === db.activeSeasonId) || db.seasons[0];

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === db.teacherPassword || passwordInput.trim() === '509') {
      soundEngine.playCorrect();
      setUnlocked(true);
      setPasswordError('');
    } else {
      soundEngine.playWrong();
      setPasswordError('密碼錯誤（預設教師密碼為 509）');
    }
  };

  const handleLoadSampleCsv = () => {
    soundEngine.playClick();
    setCsvInput(
      [
        '題目編號,科目,單元,內容類型,作答形式,難度,題幹,選項,正確答案,解析,圖片檔名,音檔,用途,來源',
        'CH-201,國語,第一單元,形近字,選擇,medium,「百折不□」的空格應填入哪個字？,撓;饒;繞;澆,撓,百折不撓指意志剛強，雖受盡挫折仍不屈服,,,both,五上第一單元習作',
        'MA-201,數學,第一單元,計算,數字輸入,medium,計算分數加法：1/3 + 1/6 等於多少？（最簡分數）,,1/2,通分 2/6 + 1/6 = 3/6 = 1/2,,,both,五上數學課本',
      ].join('\n')
    );
  };

  const handleRunCsvImport = () => {
    soundEngine.playClick();
    const res = validateAndParseQuestionCsv(csvInput, db.questions);
    setCsvResultMsg({
      importedCount: res.validQuestions.length,
      errors: res.errors,
    });
    if (res.validQuestions.length > 0) {
      onUpdateDb((prev) => {
        const incomingIds = new Set(res.validQuestions.map((q) => q.id));
        const kept = prev.questions.filter((q) => !incomingIds.has(q.id));
        return {
          ...prev,
          questions: [...res.validQuestions, ...kept],
        };
      });
    }
  };

  const handlePublishAllDrafts = () => {
    soundEngine.playCorrect();
    onUpdateDb((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.status === 'draft'
          ? { ...q, status: 'published', updatedAt: new Date().toISOString() }
          : q
      ),
    }));
  };

  const handleToggleQuestionStatus = (qId: string) => {
    soundEngine.playClick();
    onUpdateDb((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === qId
          ? {
              ...q,
              version: q.version + 1,
              status: q.status === 'published' ? 'draft' : 'published',
              updatedAt: new Date().toISOString(),
            }
          : q
      ),
    }));
  };

  const handleGenerateFromMaterial = async () => {
    if (!aiMaterial.trim()) {
      setAiMessage('請先貼上課文段落、單字表或習作重點文字');
      return;
    }
    setAiLoading(true);
    setAiMessage('');
    try {
      const resp = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: aiSubject,
          unit: aiUnit,
          materialText: aiMaterial,
          count: 2,
        }),
      });
      const data = (await resp.json()) as { ok?: boolean; drafts?: QuestionItem[]; error?: string };
      if (data.drafts && data.drafts.length > 0) {
        onUpdateDb((prev) => ({
          ...prev,
          questions: [...data.drafts!, ...prev.questions],
        }));
        soundEngine.playCorrect();
        setAiMessage(`已成功產生 ${data.drafts.length} 題草稿！請於下方題庫清單核對後發布。`);
        setAiMaterial('');
      } else {
        setAiMessage(data.error || '未能產生題目');
      }
    } catch {
      setAiMessage('連線異常，請稍後再試');
    } finally {
      setAiLoading(false);
    }
  };

  const handleVoidMatch = (matchId: string) => {
    const reason = voidReasonMap[matchId]?.trim() || '電子白板設備異常，教師作廢並恢復當日與正式機會';
    soundEngine.playClick();
    onUpdateDb((prev) => ({
      ...prev,
      matches: prev.matches.map((m) =>
        m.id === matchId
          ? {
              ...m,
              voided: !m.voided,
              voidReason: !m.voided ? reason : undefined,
              voidedAt: !m.voided ? new Date().toISOString() : undefined,
            }
          : m
      ),
    }));
  };

  const handleStartNewSeason = () => {
    soundEngine.playFanfare();
    const nextIdx = db.seasons.length + 1;
    const today = new Date();
    const twoWeeksLater = new Date(today.getTime() + 14 * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const newSeason: SeasonConfig = {
      ...activeSeason,
      id: `season-2026-s${nextIdx}-${Date.now().toString().slice(-3)}`,
      name: `509班 第${nextIdx}賽季（兩週爭霸賽）`,
      startDate: fmt(today),
      endDate: fmt(twoWeeksLater),
      isActive: true,
    };

    onUpdateDb((prev) => ({
      ...prev,
      seasons: prev.seasons.map((s) => ({ ...s, isActive: false })).concat(newSeason),
      activeSeasonId: newSeason.id,
    }));
  };

  const handleExportCsv = () => {
    soundEngine.playClick();
    const header = '場次編號,賽季,日期,科目,關卡,左側座號,左側暱稱,左側模式,左側分數,右側座號,右側暱稱,右側模式,右側分數,勝負,狀態,作廢原因';
    const rows = db.matches.map((m) =>
      [
        m.id,
        m.seasonId,
        m.dateTaiwan,
        SUBJECT_NAMES[m.subjectId],
        m.stageName,
        m.playerLeft.studentNumber,
        m.playerLeft.nickname,
        m.playerLeft.mode === 'official' ? '正式挑戰' : '自由練習',
        m.playerLeft.score,
        m.playerRight.studentNumber,
        m.playerRight.nickname,
        m.playerRight.mode === 'official' ? '正式挑戰' : '自由練習',
        m.playerRight.score,
        m.winner,
        m.voided ? '已作廢' : '有效',
        m.voidReason || '',
      ].join(',')
    );
    const csvContent = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `509競技場_對戰成績匯出_${activeSeason.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredQuestions = db.questions.filter((q) =>
    filterSubject === 'all' ? true : q.subjectId === filterSubject
  );
  const draftCount = db.questions.filter((q) => q.status === 'draft').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="教師設定與題庫管理後台"
      className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4 md:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-6xl bg-[#0B1D36] border-2 border-sky-400/60 rounded-2xl shadow-2xl text-white flex flex-col max-h-[90vh] overflow-hidden">
        {/* 頂部標題列 */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#071324] border-b border-sky-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 text-slate-950 flex items-center justify-center font-black">
              509
            </div>
            <div>
              <h2 className="text-xl font-black tracking-wide">509競技場 · 教師設定與題庫管理後台</h2>
              <p className="text-xs text-sky-300">
                管理學生名單、Excel/CSV題庫匯入、兩週賽季規則、設備異常場次作廢與成績匯出
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center gap-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" /> 關閉返回首頁
          </button>
        </div>

        {!unlocked ? (
          <form onSubmit={handleUnlock} className="p-8 max-w-md mx-auto my-auto space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/20 border-2 border-sky-400 text-sky-300 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black">請輸入教師管理密碼</h3>
            <p className="text-sm text-sky-200">
              為避免學生下課時間誤改題庫或賽季設定，進入後台需驗證密碼（預設密碼：<span className="font-mono font-black text-amber-400">509</span>）
            </p>
            <div>
              <label htmlFor="teacher-password-input" className="sr-only">
                教師密碼
              </label>
              <input
                id="teacher-password-input"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="輸入密碼 509"
                className="w-full px-4 py-3 rounded-xl bg-[#071324] border-2 border-sky-400/60 text-center text-2xl font-mono font-black text-white focus:outline-none focus:border-orange-400"
              />
            </div>
            {passwordError && (
              <div className="text-sm font-bold text-orange-400">{passwordError}</div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPasswordInput('509')}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-300 cursor-pointer"
              >
                填入預設 509
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-lg cursor-pointer"
              >
                驗證進入後台
              </button>
            </div>
          </form>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 後台分頁切換 */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 bg-[#09172B] border-b border-slate-800">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('questions')}
                  className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 cursor-pointer ${
                    activeTab === 'questions'
                      ? 'bg-orange-500 text-slate-950 font-black'
                      : 'bg-[#102A4C] text-sky-200 hover:bg-[#163763]'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  題庫與CSV匯入 ({db.questions.length}題 / 草稿{draftCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('matches')}
                  className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 cursor-pointer ${
                    activeTab === 'matches'
                      ? 'bg-orange-500 text-slate-950 font-black'
                      : 'bg-[#102A4C] text-sky-200 hover:bg-[#163763]'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  對戰紀錄與異常恢復 ({db.matches.length}場)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('season')}
                  className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 cursor-pointer ${
                    activeTab === 'season'
                      ? 'bg-orange-500 text-slate-950 font-black'
                      : 'bg-[#102A4C] text-sky-200 hover:bg-[#163763]'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  賽季與判分規則
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('students')}
                  className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 cursor-pointer ${
                    activeTab === 'students'
                      ? 'bg-orange-500 text-slate-950 font-black'
                      : 'bg-[#102A4C] text-sky-200 hover:bg-[#163763]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  509班學生名冊 ({db.students.length}人)
                </button>
              </div>

              <button
                type="button"
                onClick={onResetDemoDb}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 重置示範資料
              </button>
            </div>

            {/* 分頁內容區 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: 題庫與CSV匯入 */}
              {activeTab === 'questions' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 左欄：CSV/Excel 固定格式批次匯入 */}
                    <div className="p-4 rounded-xl bg-[#071324] border border-sky-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-black text-sky-300">
                          步驟一：Excel / CSV 固定格式批次匯入（先存草稿）
                        </h3>
                        <button
                          type="button"
                          onClick={handleLoadSampleCsv}
                          className="px-3 py-1 rounded-lg bg-sky-500/20 border border-sky-400 text-xs font-bold text-sky-200 cursor-pointer"
                        >
                          載入範例格式
                        </button>
                      </div>
                      <p className="text-xs text-slate-300">
                        欄位順序：題目編號, 科目, 單元, 內容類型, 作答形式, 難度, 題幹, 選項(;分隔), 正確答案, 解析。系統自動檢查缺答案、重複編號與格式錯誤。
                      </p>
                      <textarea
                        rows={4}
                        value={csvInput}
                        onChange={(e) => setCsvInput(e.target.value)}
                        placeholder="在此貼上 Excel 或 CSV 題庫內容..."
                        className="w-full p-3 rounded-xl bg-[#0B1D36] border border-slate-700 text-xs font-mono text-white"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleRunCsvImport}
                          className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-sm cursor-pointer"
                        >
                          驗證並匯入為草稿
                        </button>
                        {draftCount > 0 && (
                          <button
                            type="button"
                            onClick={handlePublishAllDrafts}
                            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-sm flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            一鍵發布全部草稿 ({draftCount}題)
                          </button>
                        )}
                      </div>

                      {csvResultMsg && (
                        <div className="p-3 rounded-lg bg-[#0B1D36] border border-sky-500/40 text-xs space-y-1">
                          <div className="font-bold text-sky-300">
                            匯入結果：成功存為草稿 {csvResultMsg.importedCount} 題
                          </div>
                          {csvResultMsg.errors.map((err, i) => (
                            <div key={i} className="text-orange-400 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              第 {err.rowNumber} 列：{err.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 右欄：提供教材 -> AI協助整理及出題 */}
                    <div className="p-4 rounded-xl bg-[#071324] border border-sky-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-black text-amber-300 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" />
                          步驟二：提供課本／習作／單字表 → AI 輔助整理出題
                        </h3>
                        <span className="text-[11px] text-slate-400">先存草稿，教師核對後發布</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          aria-label="選擇出題科目"
                          value={aiSubject}
                          onChange={(e) => setAiSubject(e.target.value as SubjectId)}
                          className="px-3 py-2 rounded-lg bg-[#0B1D36] border border-slate-700 text-sm font-bold text-white"
                        >
                          {SUBJECT_ORDER.map((sub) => (
                            <option key={sub} value={sub}>
                              {SUBJECT_NAMES[sub]}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          aria-label="單元名稱"
                          value={aiUnit}
                          onChange={(e) => setAiUnit(e.target.value)}
                          placeholder="單元名稱（如：第一單元）"
                          className="px-3 py-2 rounded-lg bg-[#0B1D36] border border-slate-700 text-sm text-white"
                        />
                      </div>
                      <textarea
                        rows={3}
                        value={aiMaterial}
                        onChange={(e) => setAiMaterial(e.target.value)}
                        placeholder="貼上課文重點、單字表或考卷文字，AI 將自動整理為草稿題目供您審核..."
                        className="w-full p-3 rounded-xl bg-[#0B1D36] border border-slate-700 text-xs text-white"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          disabled={aiLoading}
                          onClick={handleGenerateFromMaterial}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm cursor-pointer"
                        >
                          {aiLoading ? 'AI 命題整理中...' : '產生草稿題目'}
                        </button>
                        {aiMessage && (
                          <span className="text-xs font-bold text-sky-300">{aiMessage}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 題庫列表與版本狀態 */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black">篩選科目：</span>
                        <button
                          type="button"
                          onClick={() => setFilterSubject('all')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                            filterSubject === 'all'
                              ? 'bg-sky-400 text-slate-950'
                              : 'bg-[#102A4C] text-slate-200'
                          }`}
                        >
                          全部 ({db.questions.length})
                        </button>
                        {SUBJECT_ORDER.map((sub) => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setFilterSubject(sub)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                              filterSubject === sub
                                ? 'bg-sky-400 text-slate-950'
                                : 'bg-[#102A4C] text-slate-200'
                            }`}
                          >
                            {SUBJECT_NAMES[sub]} (
                            {db.questions.filter((q) => q.subjectId === sub).length})
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#071324] text-slate-300 border-b border-slate-800">
                          <tr>
                            <th className="p-3">編號/版本</th>
                            <th className="p-3">科目/單元</th>
                            <th className="p-3">內容類型 / 作答形式</th>
                            <th className="p-3">題幹與正確答案</th>
                            <th className="p-3">狀態 / 操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {filteredQuestions.map((q) => (
                            <tr key={q.id} className="hover:bg-[#102A4C]/50">
                              <td className="p-3 font-mono font-bold text-sky-300 whitespace-nowrap">
                                {q.id} <span className="text-slate-400">v{q.version}</span>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="font-bold text-white">{SUBJECT_NAMES[q.subjectId]}</div>
                                <div className="text-slate-400">{q.unit}</div>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="font-bold text-amber-300">{q.contentType}</div>
                                <div className="text-slate-400">{q.answerFormat}</div>
                              </td>
                              <td className="p-3 max-w-md">
                                <div className="font-semibold text-white truncate">{q.stem}</div>
                                <div className="text-sky-300 mt-0.5">答案：{q.correctAnswer}</div>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleToggleQuestionStatus(q.id)}
                                  className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer ${
                                    q.status === 'published'
                                      ? 'bg-sky-500/20 border border-sky-400 text-sky-200'
                                      : 'bg-orange-500 text-slate-950 font-black'
                                  }`}
                                >
                                  {q.status === 'published' ? '已發布 (點擊轉草稿)' : '草稿 · 點擊發布'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: 對戰紀錄與異常處理 */}
              {activeTab === 'matches' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#071324] p-4 rounded-xl border border-sky-500/30">
                    <div>
                      <h3 className="text-base font-black text-white">
                        設備異常處理與對戰紀錄查詢
                      </h3>
                      <p className="text-xs text-sky-300">
                        若下課期間電子白板當機或斷線，教師可將該場次標記「作廢」，系統會立即退還學生當日關卡限制與正式挑戰次數。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-sm flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      匯出成績 CSV
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#071324] text-slate-300 border-b border-slate-800">
                        <tr>
                          <th className="p-3">場次 / 日期</th>
                          <th className="p-3">科目 / 關卡</th>
                          <th className="p-3">左側玩家 (1P)</th>
                          <th className="p-3">右側玩家 (2P)</th>
                          <th className="p-3">狀態與異常處理</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {db.matches.map((m) => (
                          <tr
                            key={m.id}
                            className={m.voided ? 'bg-slate-900/60 opacity-60' : 'hover:bg-[#102A4C]/40'}
                          >
                            <td className="p-3 font-mono">
                              <div className="font-bold text-sky-300">{m.id}</div>
                              <div className="text-slate-400">{m.dateTaiwan}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-bold">{SUBJECT_NAMES[m.subjectId]}</div>
                              <div className="text-slate-400">{m.stageName}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-bold">
                                {m.playerLeft.studentNumber}號 {m.playerLeft.nickname} ({m.playerLeft.score}分)
                              </div>
                              <div className="text-sky-300">
                                {m.playerLeft.mode === 'official' ? '正式挑戰' : '自由練習'}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="font-bold">
                                {m.playerRight.studentNumber}號 {m.playerRight.nickname} ({m.playerRight.score}分)
                              </div>
                              <div className="text-sky-300">
                                {m.playerRight.mode === 'official' ? '正式挑戰' : '自由練習'}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  aria-label={`場次 ${m.id} 作廢原因`}
                                  placeholder="作廢原因（如：白板斷線）"
                                  value={voidReasonMap[m.id] ?? m.voidReason ?? ''}
                                  onChange={(e) =>
                                    setVoidReasonMap((prev) => ({ ...prev, [m.id]: e.target.value }))
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-[#071324] border border-slate-700 text-xs text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleVoidMatch(m.id)}
                                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                                    m.voided
                                      ? 'bg-sky-500 text-slate-950'
                                      : 'bg-orange-500/20 border border-orange-400 text-orange-300'
                                  }`}
                                >
                                  {m.voided ? '已作廢 (點擊恢復有效)' : '作廢並退還機會'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: 賽季與判分規則 */}
              {activeTab === 'season' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-5 rounded-xl bg-[#071324] border border-sky-500/30 space-y-4">
                    <h3 className="text-lg font-black text-sky-300">目前兩週賽季設定</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">賽季名稱</label>
                        <input
                          type="text"
                          value={activeSeason.name}
                          onChange={(e) =>
                            onUpdateDb((prev) => ({
                              ...prev,
                              seasons: prev.seasons.map((s) =>
                                s.id === activeSeason.id ? { ...s, name: e.target.value } : s
                              ),
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#0B1D36] border border-slate-700 text-white font-bold"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-300 mb-1">開始日期</label>
                          <input
                            type="date"
                            value={activeSeason.startDate}
                            onChange={(e) =>
                              onUpdateDb((prev) => ({
                                ...prev,
                                seasons: prev.seasons.map((s) =>
                                  s.id === activeSeason.id ? { ...s, startDate: e.target.value } : s
                                ),
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg bg-[#0B1D36] border border-slate-700 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-300 mb-1">結束日期</label>
                          <input
                            type="date"
                            value={activeSeason.endDate}
                            onChange={(e) =>
                              onUpdateDb((prev) => ({
                                ...prev,
                                seasons: prev.seasons.map((s) =>
                                  s.id === activeSeason.id ? { ...s, endDate: e.target.value } : s
                                ),
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg bg-[#0B1D36] border border-slate-700 text-white font-mono"
                          />
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={handleStartNewSeason}
                          className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-sm cursor-pointer"
                        >
                          開啟新一季（兩週賽季 · 重新計分並保留歷史紀錄）
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-[#071324] border border-sky-500/30 space-y-4">
                    <h3 className="text-lg font-black text-amber-300">數學與英文判分細節設定</h3>
                    <div className="space-y-3 text-sm">
                      <label className="flex items-center justify-between p-3 rounded-lg bg-[#0B1D36] border border-slate-800 cursor-pointer">
                        <span>數學：接受等值分數（如 2/4 視為與 1/2 等值）</span>
                        <input
                          type="checkbox"
                          checked={activeSeason.rules.mathAllowEquivalentFractions}
                          onChange={(e) =>
                            onUpdateDb((prev) => ({
                              ...prev,
                              seasons: prev.seasons.map((s) =>
                                s.id === activeSeason.id
                                  ? {
                                      ...s,
                                      rules: {
                                        ...s.rules,
                                        mathAllowEquivalentFractions: e.target.checked,
                                      },
                                    }
                                  : s
                              ),
                            }))
                          }
                          className="w-5 h-5 accent-orange-500"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 rounded-lg bg-[#0B1D36] border border-slate-800 cursor-pointer">
                        <span>數學：強制要求最簡分數（如必須約分為 3/4）</span>
                        <input
                          type="checkbox"
                          checked={activeSeason.rules.mathRequireSimplifiedFraction}
                          onChange={(e) =>
                            onUpdateDb((prev) => ({
                              ...prev,
                              seasons: prev.seasons.map((s) =>
                                s.id === activeSeason.id
                                  ? {
                                      ...s,
                                      rules: {
                                        ...s.rules,
                                        mathRequireSimplifiedFraction: e.target.checked,
                                      },
                                    }
                                  : s
                              ),
                            }))
                          }
                          className="w-5 h-5 accent-orange-500"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 rounded-lg bg-[#0B1D36] border border-slate-800 cursor-pointer">
                        <span>英文：區分大小寫（系統預設自動忽略前後空白）</span>
                        <input
                          type="checkbox"
                          checked={activeSeason.rules.englishCaseSensitive}
                          onChange={(e) =>
                            onUpdateDb((prev) => ({
                              ...prev,
                              seasons: prev.seasons.map((s) =>
                                s.id === activeSeason.id
                                  ? {
                                      ...s,
                                      rules: {
                                        ...s.rules,
                                        englishCaseSensitive: e.target.checked,
                                      },
                                    }
                                  : s
                              ),
                            }))
                          }
                          className="w-5 h-5 accent-orange-500"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: 學生名冊管理 */}
              {activeTab === 'students' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 p-4 rounded-xl bg-[#071324] border border-sky-500/30">
                    <input
                      type="text"
                      aria-label="新增學生座號"
                      placeholder="座號 (如 29)"
                      value={newStuNo}
                      onChange={(e) => setNewStuNo(e.target.value)}
                      className="w-28 px-3 py-2 rounded-lg bg-[#0B1D36] border border-slate-700 text-sm font-mono text-white"
                    />
                    <input
                      type="text"
                      aria-label="新增學生姓名暱稱"
                      placeholder="學生姓名或暱稱"
                      value={newStuName}
                      onChange={(e) => setNewStuName(e.target.value)}
                      className="w-44 px-3 py-2 rounded-lg bg-[#0B1D36] border border-slate-700 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newStuNo.trim() || !newStuName.trim()) return;
                        const padded = newStuNo.trim().padStart(2, '0');
                        soundEngine.playClick();
                        onUpdateDb((prev) => {
                          const exists = prev.students.some((s) => s.number === padded);
                          if (exists) {
                            return {
                              ...prev,
                              students: prev.students.map((s) =>
                                s.number === padded ? { ...s, nickname: newStuName.trim() } : s
                              ),
                            };
                          }
                          const newProfile: StudentProfile = {
                            number: padded,
                            nickname: newStuName.trim(),
                            avatarId: 'azure_knight',
                            active: true,
                          };
                          return {
                            ...prev,
                            students: [...prev.students, newProfile].sort((a, b) =>
                              a.number.localeCompare(b.number)
                            ),
                          };
                        });
                        setNewStuNo('');
                        setNewStuName('');
                      }}
                      className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-sm flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> 新增或更新座號
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                    {db.students.map((stu) => (
                      <div
                        key={stu.number}
                        className="p-3 rounded-xl bg-[#071324] border border-slate-800 flex flex-col items-center text-center"
                      >
                        <div className="text-xs font-mono font-black text-sky-400">
                          {stu.number}號
                        </div>
                        <div className="text-sm font-black text-white mt-0.5">{stu.nickname}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {AVATAR_CATALOG[stu.avatarId]?.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
