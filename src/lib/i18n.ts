export type Lang = 'EN' | 'ZH';

export const t = {
  // Header
  appTitle:    { EN: 'SG Lottery',              ZH: '新加坡彩票' },
  appSubtitle: { EN: 'Singapore Pools Results', ZH: '新加坡马票成绩' },

  // Tabs
  results:   { EN: 'Results',   ZH: '成绩' },
  history:   { EN: 'History',   ZH: '历史' },
  generator: { EN: 'Generator', ZH: '生成器' },
  whatIf:    { EN: 'What If?',  ZH: '如果？' },

  // 4D / TOTO prize labels
  prize1st:     { EN: '1st Prize',    ZH: '头奖' },
  prize2nd:     { EN: '2nd Prize',    ZH: '二奖' },
  prize3rd:     { EN: '3rd Prize',    ZH: '三奖' },
  starter:      { EN: 'Starter',      ZH: '入围奖' },
  consolation:  { EN: 'Consolation',  ZH: '安慰奖' },
  additional:   { EN: 'Additional',   ZH: '附加号码' },
  drawNo:       { EN: 'Draw No.',     ZH: '期号' },
  drawDate:     { EN: 'Draw Date',    ZH: '开彩日期' },
  latestDraw:   { EN: 'Latest Draw',  ZH: '最新开彩' },
  noResults:    { EN: 'No results found', ZH: '没有成绩' },
  loading:      { EN: 'Loading...',   ZH: '加载中...' },

  // TOTO prize groups
  group1: { EN: 'Group 1', ZH: '第一组' },
  group2: { EN: 'Group 2', ZH: '第二组' },
  group3: { EN: 'Group 3', ZH: '第三组' },
  group4: { EN: 'Group 4', ZH: '第四组' },
  group5: { EN: 'Group 5', ZH: '第五组' },
  group6: { EN: 'Group 6', ZH: '第六组' },
  group7: { EN: 'Group 7', ZH: '第七组' },
  prize:  { EN: 'Prize',   ZH: '奖金' },
  shares: { EN: 'Shares',  ZH: '得奖人数' },

  // History screen
  selectMonth: { EN: 'Month', ZH: '月份' },
  selectYear:  { EN: 'Year',  ZH: '年份' },
  tapToView:   { EN: 'Tap a draw to view details', ZH: '点击查看详情' },

  // Generator screen
  generate:      { EN: 'Generate',       ZH: '生成' },
  set:           { EN: 'Set',            ZH: '组' },
  strategy:      { EN: 'Strategy',       ZH: '策略' },

  // What If screen
  bigBet:         { EN: 'Big ($)',         ZH: '大 ($)' },
  smallBet:       { EN: 'Small ($)',       ZH: '小 ($)' },
  iBet:           { EN: 'iBet',            ZH: 'iBet' },
  allPerms:       { EN: 'All Permutations', ZH: '所有排列' },
  calculate:      { EN: 'Calculate',       ZH: '计算' },
  save:           { EN: 'Save',            ZH: '保存' },
  saved:          { EN: 'Saved!',          ZH: '已保存！' },
  timeframe:      { EN: 'Timeframe',       ZH: '时间范围' },
  year:           { EN: 'Year',            ZH: '年' },
  years:          { EN: 'Years',           ZH: '年' },
  winnings:       { EN: 'Winnings',        ZH: '奖金' },
  spent:          { EN: 'Spent',           ZH: '花费' },
  draws:          { EN: 'Draws',           ZH: '期数' },
  strike:         { EN: 'Strike',          ZH: '中奖' },
  strikes:        { EN: 'Strikes',         ZH: '次中奖' },
  date:           { EN: 'Date',            ZH: '日期' },
  number:         { EN: 'Number',          ZH: '号码' },
  category:       { EN: 'Category',        ZH: '奖项' },
  noStrikes:      { EN: 'No strikes found', ZH: '没有中奖记录' },
  savedCombos:    { EN: 'Saved Combinations', ZH: '已保存号码' },
  enterNumber:    { EN: 'Enter 4-digit number', ZH: '输入4位号码' },
  pickNumbers:    { EN: 'Pick your numbers',    ZH: '选择号码' },

  // What If summary messages
  profitMsg: {
    EN: (spent: string, draws: number, perms: number, won: string) =>
      `Based on past results, you would have spent ${spent} over ${draws} draws across ${perms} unique permutations and made ${won} in winnings! 🎉 HUAT AHH!`,
    ZH: (spent: string, draws: number, perms: number, won: string) =>
      `根据过去成绩，您在 ${draws} 期内花费 ${spent}，共 ${perms} 个排列，赢得 ${won}！🎉 发啊！`,
  },
  lossMsg: {
    EN: (spent: string, draws: number, won: string) =>
      `Based on past results, you would have spent ${spent} over ${draws} draws and made ${won} in winnings. 😅 Better luck next time lah!`,
    ZH: (spent: string, draws: number, won: string) =>
      `根据过去成绩，您在 ${draws} 期内花费 ${spent}，赢得 ${won}。😅 下次好运！`,
  },
  totoStrikeMsg: {
    EN: (draws: number, strikes: number) =>
      `Over ${draws} draws, your numbers struck ${strikes} times!`,
    ZH: (draws: number, strikes: number) =>
      `在 ${draws} 期内，您的号码中奖 ${strikes} 次！`,
  },
};

// Helper: get translated string
export function tr(key: keyof typeof t, lang: Lang): string {
  const entry = t[key];
  if (typeof entry === 'object' && 'EN' in entry && typeof entry.EN === 'string') {
    return (entry as { EN: string; ZH: string })[lang];
  }
  return String(key);
}
