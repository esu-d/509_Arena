import {
  AnswerFormat,
  MatchRecord,
  PlayMode,
  QuestionItem,
  SeasonConfig,
  SeasonRuleConfig,
  StageConfig,
  StudentProfile,
  SubjectId,
} from './types';

export const SUBJECT_ORDER: SubjectId[] = ['chinese', 'math', 'social', 'english', 'life'];

export const SUBJECT_NAMES: Record<SubjectId, string> = {
  chinese: '國語',
  math: '數學',
  social: '社會',
  english: '英文',
  life: '生活探索',
};

/**
 * 以臺灣時間 (Asia/Taipei, UTC+8) 凌晨0點為界，回傳 YYYY-MM-DD
 */
export function getTaiwanDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export interface ParsedMathValue {
  valid: boolean;
  value: number;
  isFraction: boolean;
  numerator?: number;
  denominator?: number;
  isSimplified: boolean;
}

/**
 * 解析整數、小數、分數 (如 "3/4", "6/8", "1 1/2")
 */
export function parseMathExpression(raw: string): ParsedMathValue {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    return { valid: false, value: NaN, isFraction: false, isSimplified: true };
  }

  // 帶分數 e.g. "1 1/2"
  const mixedMatch = cleaned.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const num = Number(mixedMatch[2]);
    const den = Number(mixedMatch[3]);
    if (den === 0) return { valid: false, value: NaN, isFraction: true, isSimplified: false };
    const sign = whole < 0 ? -1 : 1;
    const totalNum = sign * (Math.abs(whole) * den + num);
    const divisor = gcd(totalNum, den);
    return {
      valid: true,
      value: totalNum / den,
      isFraction: true,
      numerator: totalNum,
      denominator: den,
      isSimplified: divisor === 1,
    };
  }

  // 真分數/假分數 e.g. "3/4", "6/8"
  const fracMatch = cleaned.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const num = Number(fracMatch[1]);
    const den = Number(fracMatch[2]);
    if (den === 0) return { valid: false, value: NaN, isFraction: true, isSimplified: false };
    const divisor = gcd(num, den);
    return {
      valid: true,
      value: num / den,
      isFraction: true,
      numerator: num,
      denominator: den,
      isSimplified: divisor === 1,
    };
  }

  // 一般整數或小數
  const numVal = Number(cleaned);
  if (!Number.isNaN(numVal) && Number.isFinite(numVal)) {
    return {
      valid: true,
      value: numVal,
      isFraction: false,
      isSimplified: true,
    };
  }

  return { valid: false, value: NaN, isFraction: false, isSimplified: false };
}

/**
 * 判分核心：支援八種作答形式與數學/英文特別規則
 */
export function evaluateAnswer(
  question: Pick<QuestionItem, 'subjectId' | 'answerFormat' | 'correctAnswer'>,
  rawSubmitted: string,
  rules: Pick<
    SeasonRuleConfig,
    'mathAllowEquivalentFractions' | 'mathRequireSimplifiedFraction' | 'englishCaseSensitive'
  >
): boolean {
  const submitted = rawSubmitted.trim();
  if (!submitted) return false;

  const acceptableAnswers = question.correctAnswer
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  if (question.answerFormat === 'number') {
    const subParsed = parseMathExpression(submitted);
    for (const ans of acceptableAnswers) {
      if (submitted === ans) {
        if (subParsed.isFraction && rules.mathRequireSimplifiedFraction && !subParsed.isSimplified) {
          return false;
        }
        return true;
      }
      const targetParsed = parseMathExpression(ans);
      if (subParsed.valid && targetParsed.valid) {
        const isEqualVal = Math.abs(subParsed.value - targetParsed.value) < 1e-7;
        if (isEqualVal) {
          if (subParsed.isFraction || targetParsed.isFraction) {
            if (!rules.mathAllowEquivalentFractions && submitted.replace(/\s+/g, '') !== ans.replace(/\s+/g, '')) {
              continue;
            }
            if (rules.mathRequireSimplifiedFraction && subParsed.isFraction && !subParsed.isSimplified) {
              return false;
            }
          }
          return true;
        }
      }
    }
    return false;
  }

  if (question.answerFormat === 'pair') {
    // 配對格式：將 L:R;L:R 依 key 排序後比對
    const normalizePairs = (str: string) =>
      str
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .sort()
        .join(';');
    const normSub = normalizePairs(submitted);
    return acceptableAnswers.some((ans) => normalizePairs(ans) === normSub);
  }

  if (question.answerFormat === 'order') {
    const normalizeOrder = (str: string) =>
      str
        .split('>')
        .map((s) => s.trim())
        .filter(Boolean)
        .join('>');
    const normSub = normalizeOrder(submitted);
    return acceptableAnswers.some((ans) => {
      if (question.subjectId === 'english' && !rules.englishCaseSensitive) {
        return normalizeOrder(ans).toLowerCase() === normSub.toLowerCase();
      }
      return normalizeOrder(ans) === normSub;
    });
  }

  // 英文大小寫與前後空白規則
  if (question.subjectId === 'english' || question.answerFormat === 'spell') {
    const cleanSub = submitted.replace(/\s+/g, ' ').trim();
    return acceptableAnswers.some((ans) => {
      const cleanAns = ans.replace(/\s+/g, ' ').trim();
      if (rules.englishCaseSensitive) {
        return cleanSub === cleanAns;
      }
      return cleanSub.toLowerCase() === cleanAns.toLowerCase();
    });
  }

  return acceptableAnswers.some((ans) => submitted === ans);
}

/**
 * 本場PK計分：分數＝首次答對題數÷總題數×100 (預設5題，每題20分)
 */
export function calculateMatchScore(firstTryCorrectCount: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 0;
  const clamped = Math.max(0, Math.min(firstTryCorrectCount, totalQuestions));
  return Math.round((clamped / totalQuestions) * 100);
}

export function determineMatchWinner(leftScore: number, rightScore: number): 'left' | 'right' | 'draw' {
  if (leftScore > rightScore) return 'left';
  if (rightScore > leftScore) return 'right';
  return 'draw';
}

export interface PlayerStageEligibility {
  canPlayStageToday: boolean;
  stageLockReason?: string;
  canPlayOfficial: boolean;
  officialBlockReason?: string;
  remainingOfficialInSeason: number;
  usedOfficialTodayInSubject: number;
  practiceLocksOfficialWarning: string;
}

/**
 * 檢查學生今日關卡鎖定、本季正式次數 (最多3次)、同科每日正式次數 (最多1次)
 */
export function checkPlayerStageEligibility(
  studentNumber: string,
  subjectId: SubjectId,
  stage: StageConfig,
  dateTaiwan: string,
  season: SeasonConfig,
  matches: MatchRecord[]
): PlayerStageEligibility {
  const validMatches = matches.filter((m) => !m.voided && m.winner !== 'in_progress');

  // 檢查今天是否已經玩過此關卡（正式與練習共用限制）
  const playedThisStageToday = validMatches.some(
    (m) =>
      m.dateTaiwan === dateTaiwan &&
      m.stageId === stage.id &&
      (m.playerLeft.studentNumber === studentNumber || m.playerRight.studentNumber === studentNumber)
  );

  // 計算本季該科已使用的正式挑戰次數
  const seasonOfficialCount = validMatches.filter((m) => {
    if (m.seasonId !== season.id || m.subjectId !== subjectId) return false;
    const isLeftOfficial = m.playerLeft.studentNumber === studentNumber && m.playerLeft.mode === 'official';
    const isRightOfficial = m.playerRight.studentNumber === studentNumber && m.playerRight.mode === 'official';
    return isLeftOfficial || isRightOfficial;
  }).length;

  // 計算今日該科已使用的正式挑戰次數
  const todayOfficialCount = validMatches.filter((m) => {
    if (m.dateTaiwan !== dateTaiwan || m.subjectId !== subjectId) return false;
    const isLeftOfficial = m.playerLeft.studentNumber === studentNumber && m.playerLeft.mode === 'official';
    const isRightOfficial = m.playerRight.studentNumber === studentNumber && m.playerRight.mode === 'official';
    return isLeftOfficial || isRightOfficial;
  }).length;

  const remainingOfficialInSeason = Math.max(
    0,
    season.rules.seasonMaxOfficialPerSubject - seasonOfficialCount
  );

  let canPlayStageToday = true;
  let stageLockReason: string | undefined;
  if (playedThisStageToday) {
    canPlayStageToday = false;
    stageLockReason = '今日已玩過此關卡（每日每關限玩一次，隔天凌晨0點解鎖）';
  }

  let canPlayOfficial = canPlayStageToday;
  let officialBlockReason: string | undefined;

  if (!canPlayStageToday) {
    canPlayOfficial = false;
    officialBlockReason = stageLockReason;
  } else if (stage.practiceOnly) {
    canPlayOfficial = false;
    officialBlockReason = '此關卡為特定題型加強關，僅開放自由練習';
  } else if (remainingOfficialInSeason <= 0) {
    canPlayOfficial = false;
    officialBlockReason = `本季${SUBJECT_NAMES[subjectId]}正式挑戰已達上限 (${season.rules.seasonMaxOfficialPerSubject}次)`;
  } else if (todayOfficialCount >= season.rules.dailyMaxOfficialPerSubject) {
    canPlayOfficial = false;
    officialBlockReason = `今日${SUBJECT_NAMES[subjectId]}已完成過正式挑戰 (同科每日限1次)`;
  }

  return {
    canPlayStageToday,
    stageLockReason,
    canPlayOfficial,
    officialBlockReason,
    remainingOfficialInSeason,
    usedOfficialTodayInSubject: todayOfficialCount,
    practiceLocksOfficialWarning: stage.practiceOnly
      ? '此加強關僅供自由練習，不計入賽季排名。'
      : '提醒：同一關卡每天只能玩一次！若今天先以「自由練習」遊玩本關，今天就不能再用「正式挑戰」玩同一關。',
  };
}

export interface DrawQuestionsResult {
  ok: boolean;
  errorReason?: string;
  leftQuestions: QuestionItem[];
  rightQuestions: QuestionItem[];
}

/**
 * 依開放單元、內容比例與難度自動抽題：
 * - 正式題優先避開學生本季已作答題目
 * - 雙方題型比例、難度、題數與配分相同，實際題目可不同
 * - 題庫不足時提示教師，不自行補入超範圍題
 */
export function drawMatchQuestionsForBothPlayers(
  subjectId: SubjectId,
  stage: StageConfig,
  leftStudentNumber: string,
  rightStudentNumber: string,
  leftMode: PlayMode,
  rightMode: PlayMode,
  season: SeasonConfig,
  allQuestions: QuestionItem[],
  matches: MatchRecord[],
  randomFn: () => number = Math.random
): DrawQuestionsResult {
  const openUnits = season.rules.openUnits[subjectId] || [];
  const publishedPool = allQuestions.filter(
    (q) =>
      q.subjectId === subjectId &&
      q.status === 'published' &&
      (openUnits.length === 0 || openUnits.includes(q.unit))
  );

  // 找出學生本季已作答過的題目 ID
  const getAnsweredIdsInSeason = (studentNo: string) => {
    const set = new Set<string>();
    for (const m of matches) {
      if (m.voided || m.seasonId !== season.id || m.subjectId !== subjectId) continue;
      if (m.playerLeft.studentNumber === studentNo) {
        m.playerLeft.questionIds.forEach((id) => set.add(id));
      }
      if (m.playerRight.studentNumber === studentNo) {
        m.playerRight.questionIds.forEach((id) => set.add(id));
      }
    }
    return set;
  };

  const leftHistory = getAnsweredIdsInSeason(leftStudentNumber);
  const rightHistory = getAnsweredIdsInSeason(rightStudentNumber);

  const shuffle = <T>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(randomFn() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const distribution = stage.practiceOnly
    ? stage.distribution
    : season.rules.subjectDistributions[subjectId] || stage.distribution;

  const leftSelected: QuestionItem[] = [];
  const rightSelected: QuestionItem[] = [];

  for (const [contentType, count] of Object.entries(distribution)) {
    if (count <= 0) continue;

    // 支援複合類型如 "字義|閱讀理解"
    const allowedTypes = contentType.split('|').map((s) => s.trim());

    const filterForMode = (mode: PlayMode) =>
      publishedPool.filter(
        (q) =>
          allowedTypes.includes(q.contentType) &&
          (q.purpose === 'both' || q.purpose === mode)
      );

    const leftCandidates = filterForMode(leftMode);
    const rightCandidates = filterForMode(rightMode);

    if (leftCandidates.length < count || rightCandidates.length < count) {
      return {
        ok: false,
        errorReason: `【題庫不足提示】${SUBJECT_NAMES[subjectId]}「${contentType}」目前已發布且在開放單元內的題目不足 ${count} 題（現有 ${Math.min(
          leftCandidates.length,
          rightCandidates.length
        )} 題），請教師至後台補充或開啟單元。`,
        leftQuestions: [],
        rightQuestions: [],
      };
    }

    // 左側玩家抽題（優先避開本季已作答）
    const leftUnseen = shuffle(leftCandidates.filter((q) => !leftHistory.has(q.id)));
    const leftSeen = shuffle(leftCandidates.filter((q) => leftHistory.has(q.id)));
    const leftPicked = [...leftUnseen, ...leftSeen].slice(0, count);
    leftSelected.push(...leftPicked);

    // 右側玩家抽題（優先避開本季已作答，且若題庫充裕時可與左側不同題但同難度/同題型）
    const leftPickedIds = new Set(leftPicked.map((q) => q.id));
    const rightUnseen = shuffle(
      rightCandidates.filter((q) => !rightHistory.has(q.id) && !leftPickedIds.has(q.id))
    );
    const rightUnseenFallback = shuffle(
      rightCandidates.filter((q) => !rightHistory.has(q.id) && leftPickedIds.has(q.id))
    );
    const rightSeen = shuffle(rightCandidates.filter((q) => rightHistory.has(q.id)));
    const rightPicked = [...rightUnseen, ...rightUnseenFallback, ...rightSeen].slice(0, count);
    rightSelected.push(...rightPicked);
  }

  return {
    ok: true,
    leftQuestions: leftSelected,
    rightQuestions: rightSelected,
  };
}

export interface StudentSubjectStat {
  subjectId: SubjectId;
  bestOfficialScore: number | null;
  officialAttemptsUsed: number;
  officialAttemptsRemaining: number;
  practiceAttemptsCount: number;
  completedOfficial: boolean;
}

export interface LeaderboardEntry {
  studentNumber: string;
  nickname: string;
  avatarId: StudentProfile['avatarId'];
  subjectBestScores: Record<SubjectId, number | null>;
  subjectOfficialCounts: Record<SubjectId, number>;
  completedSubjectsCount: number;
  isQualifiedForRank: boolean; // 五科各完成至少1次正式挑戰
  totalScore: number; // 最高500分
  rank: number | null; // 同分並列；未完成五科為 null
}

/**
 * 計算兩週賽季排行榜：
 * - 單科成績：取正式挑戰最高分
 * - 總分：五科最高分加總，滿分500分
 * - 排名資格：五科各完成至少1次正式挑戰
 * - 未完成五科：顯示完成進度，另列「挑戰進行中」
 * - 同分：並列
 */
export function computeSeasonLeaderboard(
  season: SeasonConfig,
  students: StudentProfile[],
  matches: MatchRecord[]
): {
  qualifiedRanked: LeaderboardEntry[];
  inProgressList: LeaderboardEntry[];
  bySubject: Record<SubjectId, { studentNumber: string; nickname: string; avatarId: StudentProfile['avatarId']; bestScore: number; attempts: number; rank: number }[]>;
} {
  const validSeasonMatches = matches.filter(
    (m) => !m.voided && m.seasonId === season.id && m.winner !== 'in_progress'
  );

  const entries: LeaderboardEntry[] = students
    .filter((s) => s.active)
    .map((student) => {
      const subjectBestScores: Record<SubjectId, number | null> = {
        chinese: null,
        math: null,
        social: null,
        english: null,
        life: null,
      };
      const subjectOfficialCounts: Record<SubjectId, number> = {
        chinese: 0,
        math: 0,
        social: 0,
        english: 0,
        life: 0,
      };

      for (const m of validSeasonMatches) {
        const checkSide = (side: MatchRecord['playerLeft']) => {
          if (side.studentNumber === student.number && side.mode === 'official') {
            subjectOfficialCounts[m.subjectId] += 1;
            const currentBest = subjectBestScores[m.subjectId];
            if (currentBest === null || side.score > currentBest) {
              subjectBestScores[m.subjectId] = side.score;
            }
          }
        };
        checkSide(m.playerLeft);
        checkSide(m.playerRight);
      }

      const completedSubjectsCount = SUBJECT_ORDER.filter(
        (sub) => subjectBestScores[sub] !== null
      ).length;
      const isQualifiedForRank = completedSubjectsCount === SUBJECT_ORDER.length;
      const totalScore = SUBJECT_ORDER.reduce(
        (sum, sub) => sum + (subjectBestScores[sub] ?? 0),
        0
      );

      return {
        studentNumber: student.number,
        nickname: student.nickname,
        avatarId: student.avatarId,
        subjectBestScores,
        subjectOfficialCounts,
        completedSubjectsCount,
        isQualifiedForRank,
        totalScore,
        rank: null,
      };
    });

  // 具備排名資格者：依總分排序並處理同分並列
  const qualifiedRanked = entries
    .filter((e) => e.isQualifiedForRank)
    .sort((a, b) => b.totalScore - a.totalScore || a.studentNumber.localeCompare(b.studentNumber));

  let currentRank = 1;
  for (let i = 0; i < qualifiedRanked.length; i++) {
    if (i > 0 && qualifiedRanked[i].totalScore < qualifiedRanked[i - 1].totalScore) {
      currentRank = i + 1;
    }
    qualifiedRanked[i].rank = currentRank;
  }

  // 挑戰進行中（已參與至少1科但未滿5科，或0科）
  const inProgressList = entries
    .filter((e) => !e.isQualifiedForRank)
    .sort(
      (a, b) =>
        b.completedSubjectsCount - a.completedSubjectsCount ||
        b.totalScore - a.totalScore ||
        a.studentNumber.localeCompare(b.studentNumber)
    );

  // 單科排名
  const bySubject: Record<
    SubjectId,
    { studentNumber: string; nickname: string; avatarId: StudentProfile['avatarId']; bestScore: number; attempts: number; rank: number }[]
  > = {
    chinese: [],
    math: [],
    social: [],
    english: [],
    life: [],
  };

  for (const sub of SUBJECT_ORDER) {
    const list = entries
      .filter((e) => e.subjectBestScores[sub] !== null)
      .map((e) => ({
        studentNumber: e.studentNumber,
        nickname: e.nickname,
        avatarId: e.avatarId,
        bestScore: e.subjectBestScores[sub] as number,
        attempts: e.subjectOfficialCounts[sub],
        rank: 1,
      }))
      .sort((a, b) => b.bestScore - a.bestScore || a.studentNumber.localeCompare(b.studentNumber));

    let subRank = 1;
    for (let i = 0; i < list.length; i++) {
      if (i > 0 && list[i].bestScore < list[i - 1].bestScore) {
        subRank = i + 1;
      }
      list[i].rank = subRank;
    }
    bySubject[sub] = list;
  }

  return { qualifiedRanked, inProgressList, bySubject };
}

export interface CsvImportValidationResult {
  validQuestions: QuestionItem[];
  errors: { rowNumber: number; message: string }[];
}

/**
 * 題庫 CSV / TSV 批次匯入解析與驗證：
 * 檢查缺答案、重複編號、格式錯誤；匯入先存草稿 (status: 'draft')
 */
export function validateAndParseQuestionCsv(
  rawText: string,
  existingQuestions: QuestionItem[]
): CsvImportValidationResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { validQuestions: [], errors: [{ rowNumber: 1, message: '匯入內容為空' }] };
  }

  const validQuestions: QuestionItem[] = [];
  const errors: { rowNumber: number; message: string }[] = [];
  const seenIdsInBatch = new Set<string>();
  const existingMap = new Map(existingQuestions.map((q) => [q.id, q]));

  const validSubjects = new Set<string>(SUBJECT_ORDER);
  const validFormats = new Set<string>([
    'choice',
    'pair',
    'typo',
    'number',
    'order',
    'spell',
    'listen',
    'image_judge',
  ]);

  // 若第一列包含標題字樣則跳過
  const startIndex =
    lines[0].includes('題目編號') || lines[0].toLowerCase().includes('id,subject') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const rowNumber = i + 1;
    const delimiter = lines[i].includes('\t') ? '\t' : ',';
    const cols = lines[i].split(delimiter).map((c) => c.trim());

    // 欄位順序：題目編號, 科目, 單元, 內容類型, 作答形式, 難度, 題幹, 選項(以;分隔), 正確答案, 解析, 圖片檔名, 音檔或發音, 用途(official/practice/both), 來源
    if (cols.length < 10) {
      errors.push({
        rowNumber,
        message: `欄位數量不足（至少需10欄：題目編號、科目、單元、內容類型、作答形式、難度、題幹、選項、正確答案、解析）`,
      });
      continue;
    }

    const [
      id,
      rawSubject,
      unit,
      contentType,
      rawFormat,
      rawDiff,
      stem,
      rawOptions,
      correctAnswer,
      explanation,
      imageFile = '',
      audioText = '',
      rawPurpose = 'both',
      source = '教師匯入',
    ] = cols;

    if (!id) {
      errors.push({ rowNumber, message: '缺少題目編號' });
      continue;
    }
    if (seenIdsInBatch.has(id)) {
      errors.push({ rowNumber, message: `批次內出現重複題目編號：${id}` });
      continue;
    }
    seenIdsInBatch.add(id);

    const subjectMap: Record<string, SubjectId> = {
      chinese: 'chinese',
      國語: 'chinese',
      math: 'math',
      數學: 'math',
      social: 'social',
      社會: 'social',
      english: 'english',
      英文: 'english',
      life: 'life',
      生活探索: 'life',
    };
    const subjectId = subjectMap[rawSubject];
    if (!subjectId || !validSubjects.has(subjectId)) {
      errors.push({ rowNumber, message: `無效的科目名稱：「${rawSubject}」` });
      continue;
    }

    const formatMap: Record<string, AnswerFormat> = {
      choice: 'choice',
      選擇: 'choice',
      pair: 'pair',
      配對: 'pair',
      typo: 'typo',
      點錯字: 'typo',
      number: 'number',
      數字輸入: 'number',
      order: 'order',
      排序: 'order',
      步驟排序: 'order',
      事件順序: 'order',
      字詞排序: 'order',
      spell: 'spell',
      拼字: 'spell',
      listen: 'listen',
      聽音選答: 'listen',
      image_judge: 'image_judge',
      圖片判讀: 'image_judge',
      圖片判斷: 'image_judge',
    };
    const answerFormat = formatMap[rawFormat];
    if (!answerFormat || !validFormats.has(answerFormat)) {
      errors.push({ rowNumber, message: `無效的作答形式：「${rawFormat}」` });
      continue;
    }

    if (!stem) {
      errors.push({ rowNumber, message: `題目 (${id}) 缺少題幹` });
      continue;
    }
    if (!correctAnswer) {
      errors.push({ rowNumber, message: `題目 (${id}) 缺少正確答案` });
      continue;
    }

    const diffMap: Record<string, 'easy' | 'medium' | 'hard'> = {
      easy: 'easy',
      簡單: 'easy',
      medium: 'medium',
      中等: 'medium',
      hard: 'hard',
      困難: 'hard',
    };
    const difficulty = diffMap[rawDiff] || 'medium';

    const purposeMap: Record<string, 'official' | 'practice' | 'both'> = {
      official: 'official',
      正式: 'official',
      practice: 'practice',
      練習: 'practice',
      both: 'both',
      通用: 'both',
    };
    const purpose = purposeMap[rawPurpose] || 'both';

    let options: string[] | undefined;
    let pairs: { left: string; right: string }[] | undefined;

    if (answerFormat === 'pair') {
      pairs = rawOptions
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((pairStr) => {
          const [left, right] = pairStr.split(':').map((x) => x.trim());
          return { left: left || '', right: right || '' };
        });
      if (pairs.length < 2) {
        errors.push({ rowNumber, message: `配對題 (${id}) 選項格式錯誤，應為 左1:右1;左2:右2` });
        continue;
      }
    } else if (rawOptions) {
      options = rawOptions
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const existing = existingMap.get(id);
    const nextVersion = existing ? existing.version + 1 : 1;

    validQuestions.push({
      id,
      version: nextVersion,
      subjectId,
      unit: unit || '第一單元',
      contentType: contentType || '綜合',
      answerFormat,
      difficulty,
      stem,
      options,
      pairs,
      correctAnswer,
      explanation: explanation || '請參考課本重點解析。',
      imageFile: imageFile || undefined,
      audioText: audioText || undefined,
      purpose,
      source,
      status: 'draft', // 匯入先存草稿，確認後發布
      updatedAt: new Date().toISOString(),
    });
  }

  return { validQuestions, errors };
}
