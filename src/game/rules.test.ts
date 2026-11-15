import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMatchScore,
  checkPlayerStageEligibility,
  computeSeasonLeaderboard,
  determineMatchWinner,
  drawMatchQuestionsForBothPlayers,
  evaluateAnswer,
  getTaiwanDateString,
  parseMathExpression,
  validateAndParseQuestionCsv,
} from './rules';
import { MatchRecord, QuestionItem, SeasonConfig, StageConfig, StudentProfile } from './types';

test('calculateMatchScore and determineMatchWinner follow 509 Arena spec', () => {
  assert.equal(calculateMatchScore(5, 5), 100);
  assert.equal(calculateMatchScore(4, 5), 80);
  assert.equal(calculateMatchScore(0, 5), 0);
  assert.equal(determineMatchWinner(80, 60), 'left');
  assert.equal(determineMatchWinner(60, 100), 'right');
  assert.equal(determineMatchWinner(80, 80), 'draw');
});

test('math fraction evaluation respects equivalent and simplified fraction settings', () => {
  const q = {
    subjectId: 'math' as const,
    answerFormat: 'number' as const,
    correctAnswer: '3/4',
  };

  // Allow equivalent, do not require simplified
  assert.equal(
    evaluateAnswer(q, '6/8', {
      mathAllowEquivalentFractions: true,
      mathRequireSimplifiedFraction: false,
      englishCaseSensitive: false,
    }),
    true
  );

  // Require simplified fraction -> 6/8 should be rejected, 3/4 accepted
  assert.equal(
    evaluateAnswer(q, '6/8', {
      mathAllowEquivalentFractions: true,
      mathRequireSimplifiedFraction: true,
      englishCaseSensitive: false,
    }),
    false
  );
  assert.equal(
    evaluateAnswer(q, '3/4', {
      mathAllowEquivalentFractions: true,
      mathRequireSimplifiedFraction: true,
      englishCaseSensitive: false,
    }),
    true
  );

  const mixed = parseMathExpression('1 1/2');
  assert.equal(mixed.valid, true);
  assert.equal(mixed.value, 1.5);
  assert.equal(mixed.isSimplified, true);
});

test('english case sensitivity and trimming rules', () => {
  const q = {
    subjectId: 'english' as const,
    answerFormat: 'spell' as const,
    correctAnswer: 'Wednesday',
  };

  assert.equal(
    evaluateAnswer(q, '  wednesday  ', {
      mathAllowEquivalentFractions: true,
      mathRequireSimplifiedFraction: false,
      englishCaseSensitive: false,
    }),
    true
  );

  assert.equal(
    evaluateAnswer(q, 'wednesday', {
      mathAllowEquivalentFractions: true,
      mathRequireSimplifiedFraction: false,
      englishCaseSensitive: true,
    }),
    false
  );
});

test('daily stage limit and official challenge limits work accurately', () => {
  const season: SeasonConfig = {
    id: 'season-1',
    name: '第一賽季',
    startDate: '2026-11-01',
    endDate: '2026-11-15',
    isActive: true,
    rulesLocked: true,
    rules: {
      questionsPerMatch: 5,
      seasonMaxOfficialPerSubject: 3,
      dailyMaxOfficialPerSubject: 1,
      mathAllowEquivalentFractions: true,
      mathRequireSimplifiedFraction: true,
      englishCaseSensitive: false,
      subjectDistributions: {
        chinese: { 形近字: 2, 成語: 1, 改錯: 1, '字義|閱讀理解': 1 },
        math: { 計算: 2, 應用: 2, 概念判斷: 1 },
        social: { 課文理解: 2, 圖片判讀: 1, 因果: 1, 事件順序: 1 },
        english: { 單字: 2, 句型: 1, 發音: 1, 重組: 1 },
        life: { 生活科學: 2, 生態: 1, 環境: 1, 常識判斷: 1 },
      },
      openUnits: {
        chinese: ['第一單元'],
        math: ['第一單元'],
        social: ['第一單元'],
        english: ['Unit 1'],
        life: ['第一單元'],
      },
    },
  };

  const stage1: StageConfig = {
    id: 'ch-01',
    subjectId: 'chinese',
    code: '綜合挑戰01',
    name: '字詞與閱讀綜合01',
    unitName: '第一單元',
    description: '正式與練習皆可',
    practiceOnly: false,
    distribution: { 形近字: 2, 成語: 1, 改錯: 1, '字義|閱讀理解': 1 },
  };

  const stage2: StageConfig = {
    id: 'ch-02',
    subjectId: 'chinese',
    code: '綜合挑戰02',
    name: '字詞與閱讀綜合02',
    unitName: '第一單元',
    description: '正式與練習皆可',
    practiceOnly: false,
    distribution: { 形近字: 2, 成語: 1, 改錯: 1, '字義|閱讀理解': 1 },
  };

  const matches: MatchRecord[] = [
    {
      id: 'm1',
      seasonId: 'season-1',
      dateTaiwan: '2026-11-14',
      startedAt: '2026-11-14T10:00:00Z',
      subjectId: 'chinese',
      stageId: 'ch-01',
      stageName: '綜合挑戰01',
      touchMode: 'simultaneous',
      playerLeft: {
        studentNumber: '01',
        nickname: '小航',
        avatarId: 'azure_knight',
        mode: 'practice',
        questionIds: [],
        answers: [],
        score: 80,
      },
      playerRight: {
        studentNumber: '02',
        nickname: '小晴',
        avatarId: 'amber_ranger',
        mode: 'official',
        questionIds: [],
        answers: [],
        score: 100,
      },
      winner: 'right',
      voided: false,
    },
  ];

  // Player 01 played ch-01 in practice today -> locked for ch-01 today!
  const elig01Stage1 = checkPlayerStageEligibility('01', 'chinese', stage1, '2026-11-14', season, matches);
  assert.equal(elig01Stage1.canPlayStageToday, false);
  assert.equal(elig01Stage1.canPlayOfficial, false);

  // Player 01 can still play ch-02 in official today (0 official used today)
  const elig01Stage2 = checkPlayerStageEligibility('01', 'chinese', stage2, '2026-11-14', season, matches);
  assert.equal(elig01Stage2.canPlayStageToday, true);
  assert.equal(elig01Stage2.canPlayOfficial, true);

  // Player 02 used 1 official today in chinese -> can play ch-02 in practice, but NOT official today
  const elig02Stage2 = checkPlayerStageEligibility('02', 'chinese', stage2, '2026-11-14', season, matches);
  assert.equal(elig02Stage2.canPlayStageToday, true);
  assert.equal(elig02Stage2.canPlayOfficial, false);
  assert.equal(elig02Stage2.remainingOfficialInSeason, 2);
});

test('computeSeasonLeaderboard separates 5-subject qualified vs in-progress and handles ties', () => {
  const season: SeasonConfig = {
    id: 's1',
    name: 'S1',
    startDate: '2026-11-01',
    endDate: '2026-11-15',
    isActive: true,
    rulesLocked: true,
    rules: {} as SeasonConfig['rules'],
  };

  const students: StudentProfile[] = [
    { number: '01', nickname: '阿哲', avatarId: 'azure_knight', active: true },
    { number: '02', nickname: '小涵', avatarId: 'amber_ranger', active: true },
    { number: '03', nickname: '大維', avatarId: 'silver_pilot', active: true },
  ];

  const makeMatch = (
    id: string,
    subjectId: MatchRecord['subjectId'],
    leftNo: string,
    leftScore: number,
    rightNo: string,
    rightScore: number
  ): MatchRecord => ({
    id,
    seasonId: 's1',
    dateTaiwan: '2026-11-14',
    startedAt: '2026-11-14T09:00:00Z',
    subjectId,
    stageId: `${subjectId}-01`,
    stageName: '綜合01',
    touchMode: 'simultaneous',
    playerLeft: {
      studentNumber: leftNo,
      nickname: leftNo,
      avatarId: 'azure_knight',
      mode: 'official',
      questionIds: [],
      answers: [],
      score: leftScore,
    },
    playerRight: {
      studentNumber: rightNo,
      nickname: rightNo,
      avatarId: 'amber_ranger',
      mode: 'official',
      questionIds: [],
      answers: [],
      score: rightScore,
    },
    winner: 'draw',
    voided: false,
  });

  // Both 01 and 02 finish all 5 subjects with total 460; 03 only finishes 3 subjects
  const matches: MatchRecord[] = [
    makeMatch('1', 'chinese', '01', 100, '02', 80),
    makeMatch('2', 'math', '01', 80, '02', 100),
    makeMatch('3', 'social', '01', 100, '02', 100),
    makeMatch('4', 'english', '01', 80, '02', 80),
    makeMatch('5', 'life', '01', 100, '02', 100),
    makeMatch('6', 'chinese', '03', 100, '01', 60), // 01's lower score 60 is ignored because best is 100
  ];

  const board = computeSeasonLeaderboard(season, students, matches);
  assert.equal(board.qualifiedRanked.length, 2);
  assert.equal(board.qualifiedRanked[0].totalScore, 460);
  assert.equal(board.qualifiedRanked[1].totalScore, 460);
  assert.equal(board.qualifiedRanked[0].rank, 1);
  assert.equal(board.qualifiedRanked[1].rank, 1); // Tied rank!

  assert.equal(board.inProgressList.length, 1);
  assert.equal(board.inProgressList[0].studentNumber, '03');
  assert.equal(board.inProgressList[0].completedSubjectsCount, 1);
});

test('validateAndParseQuestionCsv catches errors and imports valid rows as draft', () => {
  const csv = [
    '題目編號,科目,單元,內容類型,作答形式,難度,題幹,選項,正確答案,解析,圖片檔名,音檔,用途,來源',
    'CH-901,國語,第一單元,形近字,選擇,medium,下列何者用字完全正確？,再接再厲;再接再勵,再接再厲,厲是勉勵的意思,,,both,習作',
    'CH-901,國語,第一單元,形近字,選擇,medium,重複編號測試,A;B,A,解析,,,both,習作',
    'CH-902,國語,第一單元,形近字,選擇,medium,缺答案測試,A;B,,解析,,,both,習作',
  ].join('\n');

  const res = validateAndParseQuestionCsv(csv, []);
  assert.equal(res.validQuestions.length, 1);
  assert.equal(res.validQuestions[0].id, 'CH-901');
  assert.equal(res.validQuestions[0].status, 'draft');
  assert.equal(res.errors.length, 2);
  assert.equal(typeof getTaiwanDateString(), 'string');
});

test('drawMatchQuestionsForBothPlayers draws matching distribution and avoids seen questions', () => {
  const season: SeasonConfig = {
    id: 's1',
    name: 'S1',
    startDate: '2026-11-01',
    endDate: '2026-11-15',
    isActive: true,
    rulesLocked: true,
    rules: {
      questionsPerMatch: 2,
      seasonMaxOfficialPerSubject: 3,
      dailyMaxOfficialPerSubject: 1,
      mathAllowEquivalentFractions: true,
      mathRequireSimplifiedFraction: false,
      englishCaseSensitive: false,
      subjectDistributions: {
        chinese: { 形近字: 1, 成語: 1 },
        math: {},
        social: {},
        english: {},
        life: {},
      },
      openUnits: {
        chinese: ['第一單元'],
        math: [],
        social: [],
        english: [],
        life: [],
      },
    },
  };

  const stage: StageConfig = {
    id: 'ch-01',
    subjectId: 'chinese',
    code: '綜合挑戰01',
    name: '綜合01',
    unitName: '第一單元',
    description: '',
    practiceOnly: false,
    distribution: { 形近字: 1, 成語: 1 },
  };

  const pool: QuestionItem[] = [
    {
      id: 'q1',
      version: 1,
      subjectId: 'chinese',
      unit: '第一單元',
      contentType: '形近字',
      answerFormat: 'choice',
      difficulty: 'medium',
      stem: 'Q1',
      options: ['A', 'B'],
      correctAnswer: 'A',
      explanation: 'E1',
      purpose: 'both',
      source: '課本',
      status: 'published',
      updatedAt: '',
    },
    {
      id: 'q2',
      version: 1,
      subjectId: 'chinese',
      unit: '第一單元',
      contentType: '形近字',
      answerFormat: 'choice',
      difficulty: 'medium',
      stem: 'Q2',
      options: ['A', 'B'],
      correctAnswer: 'B',
      explanation: 'E2',
      purpose: 'both',
      source: '課本',
      status: 'published',
      updatedAt: '',
    },
    {
      id: 'q3',
      version: 1,
      subjectId: 'chinese',
      unit: '第一單元',
      contentType: '成語',
      answerFormat: 'choice',
      difficulty: 'medium',
      stem: 'Q3',
      options: ['C', 'D'],
      correctAnswer: 'C',
      explanation: 'E3',
      purpose: 'both',
      source: '課本',
      status: 'published',
      updatedAt: '',
    },
  ];

  const res = drawMatchQuestionsForBothPlayers(
    'chinese',
    stage,
    '01',
    '02',
    'official',
    'official',
    season,
    pool,
    []
  );
  assert.equal(res.ok, true);
  assert.equal(res.leftQuestions.length, 2);
  assert.equal(res.rightQuestions.length, 2);
});
