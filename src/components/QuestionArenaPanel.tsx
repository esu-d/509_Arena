import React, { useEffect, useMemo, useState } from 'react';
import { PlayMode, QuestionItem, StudentProfile } from '../game/types';
import { VoxelAvatar, QuestionDiagramGraphic } from './VoxelGraphics';
import { soundEngine } from '../utils/sound';
import { Volume2, CheckCircle2, XCircle, RotateCcw, ArrowRight, Delete } from 'lucide-react';

interface QuestionArenaPanelProps {
  side: 'left' | 'right';
  student: StudentProfile;
  mode: PlayMode;
  questions: QuestionItem[];
  currentIndex: number;
  score: number;
  showingFeedback: boolean;
  lastSubmittedAnswer?: string;
  lastIsCorrect?: boolean;
  finished: boolean;
  isTurnActive: boolean; // For turn-based mode when smartboard only supports single-touch
  onSubmitAnswer: (answer: string) => void;
  onNextQuestion: () => void;
}

const FORMAT_LABELS: Record<QuestionItem['answerFormat'], string> = {
  choice: '選擇題',
  pair: '點選配對',
  typo: '點選錯字',
  number: '數字／分數輸入',
  order: '點選排序',
  spell: '字母拼字',
  listen: '聽音選答',
  image_judge: '圖表判讀',
};

export const QuestionArenaPanel: React.FC<QuestionArenaPanelProps> = ({
  side,
  student,
  mode,
  questions,
  currentIndex,
  score,
  showingFeedback,
  lastSubmittedAnswer,
  lastIsCorrect,
  finished,
  isTurnActive,
  onSubmitAnswer,
  onNextQuestion,
}) => {
  const question = questions[currentIndex];
  const isLeft = side === 'left';

  // Local interactive states for different formats
  const [selectedChoice, setSelectedChoice] = useState<string>('');
  const [numberInput, setNumberInput] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [activeLeftPair, setActiveLeftPair] = useState<string | null>(null);
  const [pairedMap, setPairedMap] = useState<Record<string, string>>({});
  const [spelledIndices, setSpelledIndices] = useState<number[]>([]);

  // Deterministic scramble for order/spell/pair options per question ID
  const scrambledOptions = useMemo(() => {
    if (!question?.options) return [];
    if (question.answerFormat !== 'order' && question.answerFormat !== 'spell') {
      return question.options;
    }
    const items = [...question.options];
    // Deterministic rotation based on question id + side so it's not already in exact answer order
    const seed = question.id.charCodeAt(question.id.length - 1) + (side === 'left' ? 1 : 2);
    return items
      .map((item, idx) => ({ item, sortKey: ((idx + 1) * 37 + seed * 13) % 97 }))
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((x) => x.item);
  }, [question, side]);

  const scrambledRightPairs = useMemo(() => {
    if (!question?.pairs) return [];
    const rights = question.pairs.map((p) => p.right);
    return [...rights].reverse();
  }, [question]);

  useEffect(() => {
    setSelectedChoice('');
    setNumberInput('');
    setSelectedOrder([]);
    setActiveLeftPair(null);
    setPairedMap({});
    setSpelledIndices([]);
  }, [question?.id, currentIndex]);

  if (finished) {
    return (
      <section
        aria-label={`${isLeft ? '左側玩家' : '右側玩家'}作答完成區`}
        className="flex flex-col justify-between h-full rounded-2xl bg-[#0B1D36] border-2 border-sky-400/40 p-5 text-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-sky-500/20 pb-3">
          <div className="flex items-center gap-3">
            <VoxelAvatar avatarId={student.avatarId} size={52} badgeNumber={student.number} />
            <div>
              <div className="text-lg font-black tracking-wide">
                {student.number}號 · {student.nickname}
              </div>
              <div className="text-xs text-sky-300">
                {mode === 'official' ? '正式挑戰（計入賽季）' : '自由練習（複習加強）'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-300">目前得分</div>
            <div className="text-3xl font-black text-amber-400 font-mono tabular-nums">{score}</div>
          </div>
        </div>

        <div className="my-auto text-center py-12 px-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-sky-500/20 border-2 border-sky-400 text-sky-300 mb-4">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h3 className="text-2xl font-black text-white mb-2">已完成全部 {questions.length} 題！</h3>
          <p className="text-base text-sky-200">
            本場得分 <span className="font-mono font-black text-amber-400 text-xl tabular-nums">{score}</span> 分，正在等待另一側同學完成作答...
          </p>
        </div>

        <div className="text-center text-xs text-slate-400 py-2 border-t border-slate-800">
          雙方皆完成後將自動進入結算與解析畫面
        </div>
      </section>
    );
  }

  if (!question) return null;

  const handleConfirmChoice = (val: string) => {
    if (!isTurnActive || showingFeedback) return;
    soundEngine.playClick();
    setSelectedChoice(val);
    onSubmitAnswer(val);
  };

  const handleTapPairLeft = (leftVal: string) => {
    if (!isTurnActive || showingFeedback) return;
    soundEngine.playClick(0.95);
    setActiveLeftPair(leftVal);
  };

  const handleTapPairRight = (rightVal: string) => {
    if (!isTurnActive || showingFeedback || !activeLeftPair) return;
    soundEngine.playClick(1.1);
    setPairedMap((prev) => ({
      ...prev,
      [activeLeftPair]: rightVal,
    }));
    setActiveLeftPair(null);
  };

  const handleSubmitPairs = () => {
    if (!question.pairs) return;
    const formatted = question.pairs
      .map((p) => `${p.left}:${pairedMap[p.left] || ''}`)
      .join(';');
    onSubmitAnswer(formatted);
  };

  const handleTapOrderItem = (item: string) => {
    if (!isTurnActive || showingFeedback) return;
    soundEngine.playClick();
    if (selectedOrder.includes(item)) {
      setSelectedOrder((prev) => prev.filter((x) => x !== item));
    } else {
      setSelectedOrder((prev) => [...prev, item]);
    }
  };

  const handleTapSpellLetter = (idx: number) => {
    if (!isTurnActive || showingFeedback) return;
    soundEngine.playClick(1.05);
    if (!spelledIndices.includes(idx)) {
      setSpelledIndices((prev) => [...prev, idx]);
    }
  };

  const spelledWord = spelledIndices.map((i) => scrambledOptions[i]).join('');

  return (
    <section
      aria-label={`${isLeft ? '左側玩家' : '右側玩家'}作答區`}
      className={`flex flex-col justify-between h-full rounded-2xl bg-[#0B1D36] border-2 ${
        isLeft ? 'border-sky-400/60' : 'border-orange-400/60'
      } p-4 md:p-5 text-white shadow-xl transition-opacity ${
        !isTurnActive ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      {/* 頂部玩家狀態列 (精簡不遮擋) */}
      <div>
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-700/80">
          <div className="flex items-center gap-2.5">
            <VoxelAvatar avatarId={student.avatarId} size={46} badgeNumber={student.number} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base md:text-lg font-black tracking-tight">
                  {student.number}號 {student.nickname}
                </span>
                <span className="text-xs text-sky-300 font-bold">
                  · {mode === 'official' ? '正式挑戰' : '自由練習'}
                </span>
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span>題型：{question.contentType}</span>
                <span>·</span>
                <span>作答：{FORMAT_LABELS[question.answerFormat]}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[11px] text-slate-300">進度</div>
              <div className="text-lg font-black font-mono tabular-nums text-sky-300">
                {currentIndex + 1} / {questions.length}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-300">分數</div>
              <div className="text-2xl font-black font-mono tabular-nums text-amber-400">
                {score}
              </div>
            </div>
          </div>
        </div>

        {/* 進度方塊格 */}
        <div className="grid grid-cols-5 gap-1.5 my-2.5">
          {questions.map((q, idx) => {
            const isCurrent = idx === currentIndex;
            const isDone = idx < currentIndex;
            return (
              <div
                key={q.id}
                className={`h-2 rounded-sm transition-colors ${
                  isDone
                    ? 'bg-sky-400'
                    : isCurrent
                    ? 'bg-orange-400'
                    : 'bg-slate-800'
                }`}
              />
            );
          })}
        </div>

        {/* 題幹顯示區 (中段大字清晰閱讀，貼近中下方作答按鈕) */}
        <div className="mt-4 p-5 md:p-6 rounded-2xl bg-[#071324] border-2 border-sky-500/30 min-h-[160px] flex flex-col justify-center">
          {question.answerFormat === 'image_judge' && (
            <QuestionDiagramGraphic imageFile={question.imageFile} />
          )}

          {question.answerFormat === 'listen' && (
            <div className="mb-3 flex items-center justify-between bg-sky-950/80 border border-sky-400/50 rounded-xl px-4 py-2.5">
              <div className="text-sm font-bold text-sky-200">
                英聽發音辨識題
              </div>
              <button
                type="button"
                onClick={() => soundEngine.speakEnglish(question.audioText || question.correctAnswer)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-sm shadow cursor-pointer"
              >
                <Volume2 className="w-5 h-5" />
                播放英文發音
              </button>
            </div>
          )}

          <p className="text-xl md:text-2xl font-black leading-relaxed text-white">
            <span className="text-sky-400 font-mono mr-2">Q{currentIndex + 1}.</span>
            {question.stem}
          </p>
        </div>
      </div>

      {/* 中下方大按鈕作答區 或 答題回饋解析區 (電子白板人體工學配置) */}
      <div className="mt-3 flex-1 flex flex-col justify-end">
        {showingFeedback ? (
          <div
            role="region"
            aria-label="作答結果與解析"
            className={`p-4 rounded-xl border-2 ${
              lastIsCorrect
                ? 'bg-sky-950/90 border-sky-400 text-sky-100'
                : 'bg-orange-950/90 border-orange-400 text-orange-100'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-lg font-black">
                {lastIsCorrect ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-sky-400 shrink-0" />
                    <span className="text-sky-300">答對了！獲得 +{Math.round(100 / questions.length)} 分</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6 text-orange-400 shrink-0" />
                    <span className="text-orange-300">答錯了（本題不加分，請看解析）</span>
                  </>
                )}
              </div>
              <span className="text-xs font-mono text-slate-300">
                你的作答：{lastSubmittedAnswer || '未作答'}
              </span>
            </div>

            {!lastIsCorrect && (
              <div className="text-sm font-black text-amber-300 mb-1.5">
                正確答案：{question.correctAnswer}
              </div>
            )}

            <p className="text-sm leading-relaxed text-slate-200 bg-slate-950/60 p-3 rounded-lg border border-slate-800 mb-3">
              <span className="font-bold text-sky-300">解析：</span>
              {question.explanation}
            </p>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onNextQuestion();
              }}
              className="w-full py-3.5 px-5 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-[0.99] text-slate-950 font-black text-lg flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <span>{currentIndex + 1 < questions.length ? '下一題' : '完成本場作答'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* 1. 選擇題 / 聽音選答 / 圖片判讀 */}
            {(question.answerFormat === 'choice' ||
              question.answerFormat === 'listen' ||
              question.answerFormat === 'image_judge') &&
              question.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {question.options.map((opt, idx) => {
                    const label = ['A', 'B', 'C', 'D'][idx] || `${idx + 1}`;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleConfirmChoice(opt)}
                        className={`min-h-[60px] p-3.5 rounded-xl border-2 text-left font-bold text-base md:text-lg flex items-center gap-3 transition-transform active:scale-[0.98] cursor-pointer ${
                          selectedChoice === opt
                            ? 'bg-orange-500 border-orange-300 text-slate-950'
                            : 'bg-[#102A4C] hover:bg-[#163763] border-sky-400/40 text-white'
                        }`}
                      >
                        <span className="w-8 h-8 rounded-lg bg-[#071324] border border-sky-400/50 text-sky-300 font-mono font-black flex items-center justify-center shrink-0">
                          {label}
                        </span>
                        <span className="leading-snug">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}

            {/* 2. 點選錯字 (Typo) */}
            {question.answerFormat === 'typo' && question.options && (
              <div className="space-y-3">
                <div className="text-xs text-sky-300 font-semibold">
                  請直接點選下方句子中的「錯別字」，再按確認送出：
                </div>
                <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-[#071324] border border-slate-700">
                  {question.options.map((char, idx) => {
                    const isPicked = selectedChoice === char;
                    return (
                      <button
                        key={`${char}-${idx}`}
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          setSelectedChoice(char);
                        }}
                        className={`w-12 h-12 rounded-xl font-black text-xl flex items-center justify-center border-2 transition-transform active:scale-95 cursor-pointer ${
                          isPicked
                            ? 'bg-orange-500 border-amber-200 text-slate-950 scale-105'
                            : 'bg-[#102A4C] hover:bg-[#163763] border-sky-400/40 text-white'
                        }`}
                      >
                        {char}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={!selectedChoice}
                  onClick={() => onSubmitAnswer(selectedChoice)}
                  className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-black text-lg cursor-pointer"
                >
                  確認送出錯字「{selectedChoice || '？'}」
                </button>
              </div>
            )}

            {/* 3. 數字／分數輸入面板 (Number) */}
            {question.answerFormat === 'number' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#071324] border-2 border-sky-400/60">
                  <span className="text-xs text-sky-300 font-bold">輸入答案（分數請用 / 如 3/4）：</span>
                  <span className="text-2xl font-mono font-black text-amber-400 tabular-nums min-h-[32px]">
                    {numberInput || '請點選下方數字鍵'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {['7', '8', '9', '/', '4', '5', '6', '.', '1', '2', '3', ' '].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setNumberInput((prev) => prev + key);
                      }}
                      className="h-12 rounded-xl bg-[#102A4C] hover:bg-[#163763] border border-sky-400/40 text-white font-mono font-black text-lg cursor-pointer"
                    >
                      {key === ' ' ? '空格' : key}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setNumberInput((prev) => prev + '0');
                    }}
                    className="h-12 rounded-xl bg-[#102A4C] hover:bg-[#163763] border border-sky-400/40 text-white font-mono font-black text-lg cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick(0.85);
                      setNumberInput((prev) => prev.slice(0, -1));
                    }}
                    className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-sm flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Delete className="w-4 h-4" /> 退格
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick(0.8);
                      setNumberInput('');
                    }}
                    className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-sm flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> 清除
                  </button>
                  <button
                    type="button"
                    disabled={!numberInput.trim()}
                    onClick={() => onSubmitAnswer(numberInput)}
                    className="h-12 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-black text-base cursor-pointer"
                  >
                    確認送出
                  </button>
                </div>
              </div>
            )}

            {/* 4. 點選配對 (Pair) */}
            {question.answerFormat === 'pair' && question.pairs && (
              <div className="space-y-2.5">
                <div className="text-xs text-sky-300 font-semibold">
                  操作方式：先點選左方項目，再點選右方對應說明完成連線配對
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-2">
                    {question.pairs.map((p) => {
                      const isSelecting = activeLeftPair === p.left;
                      const matchedRight = pairedMap[p.left];
                      return (
                        <button
                          key={p.left}
                          type="button"
                          onClick={() => handleTapPairLeft(p.left)}
                          className={`w-full min-h-[50px] p-2.5 rounded-xl border-2 text-left text-sm font-bold transition-colors cursor-pointer ${
                            isSelecting
                              ? 'bg-orange-500 border-amber-200 text-slate-950'
                              : matchedRight
                              ? 'bg-sky-900/80 border-sky-400 text-white'
                              : 'bg-[#102A4C] border-sky-400/30 text-white'
                          }`}
                        >
                          <div>{p.left}</div>
                          {matchedRight && (
                            <div className="text-[11px] text-amber-300 mt-0.5 truncate">
                              → {matchedRight}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-2">
                    {scrambledRightPairs.map((rightText) => (
                      <button
                        key={rightText}
                        type="button"
                        onClick={() => handleTapPairRight(rightText)}
                        className="w-full min-h-[50px] p-2.5 rounded-xl bg-[#102A4C] hover:bg-[#163763] border-2 border-sky-400/30 text-left text-xs md:text-sm font-semibold text-sky-100 cursor-pointer"
                      >
                        {rightText}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick(0.8);
                      setPairedMap({});
                      setActiveLeftPair(null);
                    }}
                    className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    重設配對
                  </button>
                  <button
                    type="button"
                    disabled={Object.keys(pairedMap).length < question.pairs.length}
                    onClick={handleSubmitPairs}
                    className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-black text-base cursor-pointer"
                  >
                    確認送出配對 ({Object.keys(pairedMap).length}/{question.pairs.length})
                  </button>
                </div>
              </div>
            )}

            {/* 5. 點選排序 (Order) */}
            {question.answerFormat === 'order' && (
              <div className="space-y-2.5">
                <div className="p-2.5 rounded-xl bg-[#071324] border border-sky-400/40 min-h-[48px] flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-sky-300 font-bold mr-1">已排順序：</span>
                  {selectedOrder.length === 0 ? (
                    <span className="text-xs text-slate-400">請依序點選下方按鈕進行排列</span>
                  ) : (
                    selectedOrder.map((item, idx) => (
                      <span
                        key={item}
                        className="px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-400 text-xs font-bold text-white"
                      >
                        {idx + 1}. {item}
                      </span>
                    ))
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {scrambledOptions.map((item) => {
                    const orderIdx = selectedOrder.indexOf(item);
                    const picked = orderIdx !== -1;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleTapOrderItem(item)}
                        className={`min-h-[52px] p-2.5 rounded-xl border-2 text-sm font-bold text-left flex items-center justify-between cursor-pointer ${
                          picked
                            ? 'bg-sky-800/80 border-sky-300 text-sky-100'
                            : 'bg-[#102A4C] hover:bg-[#163763] border-sky-400/40 text-white'
                        }`}
                      >
                        <span>{item}</span>
                        {picked && (
                          <span className="w-6 h-6 rounded-full bg-orange-500 text-slate-950 font-mono font-black text-xs flex items-center justify-center shrink-0">
                            {orderIdx + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick(0.8);
                      setSelectedOrder([]);
                    }}
                    className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    重排
                  </button>
                  <button
                    type="button"
                    disabled={selectedOrder.length < scrambledOptions.length}
                    onClick={() => onSubmitAnswer(selectedOrder.join('>'))}
                    className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-black text-base cursor-pointer"
                  >
                    確認送出順序
                  </button>
                </div>
              </div>
            )}

            {/* 6. 字母拼字 (Spell) */}
            {question.answerFormat === 'spell' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#071324] border-2 border-sky-400/60">
                  <span className="text-xs text-sky-300 font-bold">目前拼字：</span>
                  <span className="text-2xl font-mono font-black tracking-widest text-amber-400">
                    {spelledWord || '_ _ _ _ _'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {scrambledOptions.map((letter, idx) => {
                    const used = spelledIndices.includes(idx);
                    return (
                      <button
                        key={`${letter}-${idx}`}
                        type="button"
                        disabled={used}
                        onClick={() => handleTapSpellLetter(idx)}
                        className={`w-12 h-12 rounded-xl font-mono font-black text-xl border-2 transition-transform cursor-pointer ${
                          used
                            ? 'bg-slate-900 border-slate-800 text-slate-600 opacity-40'
                            : 'bg-[#102A4C] hover:bg-[#163763] border-sky-400/50 text-white active:scale-95'
                        }`}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick(0.8);
                      setSpelledIndices((prev) => prev.slice(0, -1));
                    }}
                    className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    退一字
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick(0.8);
                      setSpelledIndices([]);
                    }}
                    className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    重拼
                  </button>
                  <button
                    type="button"
                    disabled={!spelledWord}
                    onClick={() => onSubmitAnswer(spelledWord)}
                    className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-black text-base cursor-pointer"
                  >
                    確認送出單字
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
