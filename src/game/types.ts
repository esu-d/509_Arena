export type SubjectId = 'chinese' | 'math' | 'social' | 'english' | 'life';

export type AnswerFormat =
  | 'choice'       // 選擇
  | 'pair'         // 配對 (點選配對)
  | 'typo'         // 點錯字
  | 'number'       // 數字輸入 (支援分數/小數/整數)
  | 'order'        // 步驟排序 / 事件順序 / 字詞排序 (點選排序)
  | 'spell'        // 拼字 (點選字母或輸入)
  | 'listen'       // 聽音選答 (Web Speech / 合成語音發音)
  | 'image_judge'; // 圖片判讀 / 圖片判斷

export type PlayMode = 'official' | 'practice';

export type QuestionPoolPurpose = 'official' | 'practice' | 'both';

export type PublishStatus = 'published' | 'draft';

export interface SubjectMeta {
  id: SubjectId;
  name: string;
  subtitle: string;
  contentTypes: string[];
  answerFormats: AnswerFormat[];
  defaultDistribution: Record<string, number>;
}

export interface StageConfig {
  id: string;
  subjectId: SubjectId;
  code: string; // e.g. "綜合挑戰01", "形近字01"
  name: string;
  unitName: string;
  description: string;
  practiceOnly: boolean; // 特定類型加強關可只開放練習模式
  distribution: Record<string, number>; // 內容類型配比
}

export interface PairItem {
  left: string;
  right: string;
}

export interface QuestionItem {
  id: string;
  version: number;
  subjectId: SubjectId;
  unit: string;
  contentType: string; // e.g., 形近字, 計算, 課文理解, 單字, 生活科學
  answerFormat: AnswerFormat;
  difficulty: 'easy' | 'medium' | 'hard';
  stem: string;
  options?: string[]; // 選擇題、聽音選答、點錯字字元、或排序項目
  pairs?: PairItem[]; // 配對題左右項目
  correctAnswer: string; // 標準答案（多可接受答案以 | 分隔，排序以 > 分隔，配對以 L:R;L:R 表示）
  explanation: string;
  imageFile?: string; // 圖片檔名或內建圖示代碼
  audioText?: string; // 聽音選答發音內容或音檔檔名
  audioFile?: string;
  purpose: QuestionPoolPurpose;
  source: string;
  status: PublishStatus;
  updatedAt: string;
}

export interface StudentProfile {
  number: string; // 固定兩位數座號 e.g. "01" ~ "30"
  nickname: string;
  avatarId: 'azure_knight' | 'amber_ranger' | 'silver_pilot' | 'ice_scholar' | 'nova_builder' | 'star_captain';
  active: boolean;
}

export interface SeasonRuleConfig {
  questionsPerMatch: number; // 預設 5
  seasonMaxOfficialPerSubject: number; // 預設 3
  dailyMaxOfficialPerSubject: number; // 預設 1
  mathAllowEquivalentFractions: boolean;
  mathRequireSimplifiedFraction: boolean;
  englishCaseSensitive: boolean;
  subjectDistributions: Record<SubjectId, Record<string, number>>;
  openUnits: Record<SubjectId, string[]>;
}

export interface SeasonConfig {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD (Taiwan time)
  endDate: string;   // YYYY-MM-DD (Taiwan time)
  isActive: boolean;
  rulesLocked: boolean;
  rules: SeasonRuleConfig;
}

export interface QuestionAnswerLog {
  questionId: string;
  questionVersion: number;
  submittedAnswer: string;
  isCorrect: boolean;
  timeSpentMs: number;
}

export interface MatchPlayerRecord {
  studentNumber: string;
  nickname: string;
  avatarId: StudentProfile['avatarId'];
  mode: PlayMode;
  questionIds: string[];
  answers: QuestionAnswerLog[];
  score: number;
  completedAt?: string;
}

export interface MatchRecord {
  id: string;
  seasonId: string;
  dateTaiwan: string; // YYYY-MM-DD
  startedAt: string;
  finishedAt?: string;
  subjectId: SubjectId;
  stageId: string;
  stageName: string;
  touchMode: 'simultaneous' | 'turn_based';
  playerLeft: MatchPlayerRecord;
  playerRight: MatchPlayerRecord;
  winner: 'left' | 'right' | 'draw' | 'in_progress';
  voided: boolean;
  voidReason?: string;
  voidedAt?: string;
}

export interface ActiveMatchSession {
  matchId: string;
  seasonId: string;
  dateTaiwan: string;
  startedAt: string;
  subjectId: SubjectId;
  stageId: string;
  stageName: string;
  touchMode: 'simultaneous' | 'turn_based';
  activeTurnSide: 'left' | 'right';
  left: {
    student: StudentProfile;
    mode: PlayMode;
    questions: QuestionItem[];
    currentIndex: number;
    answers: QuestionAnswerLog[];
    showingFeedback: boolean;
    lastSubmittedAnswer?: string;
    lastIsCorrect?: boolean;
    finished: boolean;
  };
  right: {
    student: StudentProfile;
    mode: PlayMode;
    questions: QuestionItem[];
    currentIndex: number;
    answers: QuestionAnswerLog[];
    showingFeedback: boolean;
    lastSubmittedAnswer?: string;
    lastIsCorrect?: boolean;
    finished: boolean;
  };
}

export interface ArenaDatabase {
  teacherPassword: string;
  seasons: SeasonConfig[];
  activeSeasonId: string;
  students: StudentProfile[];
  stages: StageConfig[];
  questions: QuestionItem[];
  matches: MatchRecord[];
  activeSession: ActiveMatchSession | null;
}
