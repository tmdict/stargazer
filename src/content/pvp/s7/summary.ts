import type { PvpSeasonSummary } from '@/lib/types/pvp'

/* Season 7: the teams on the report's counter ladder and its counters.
 * Generated with the report and copied in beside its template, so an edit
 * made here is lost with the next copy. */
export const S7: PvpSeasonSummary = {
  season: 7,
  languages: ['en', 'zh', 'ko'],
  teams: [
    { id: 'rolan-twins', name: { en: 'Rolan/Twins', zh: '罗兰／双子', ko: '로란 대제/일리아&라이라' }, heroes: ['rolan', 'elijah-lailah'], games: 78, rating: 2.31, tier: 1 },
    { id: 'alna-athalia-eryndor', name: { en: 'Alna/Athalia/Eryndor', zh: '冬喉／天罚／埃德加', ko: '아르나/아탈리아/에린도르' }, heroes: ['alna', 'athalia', 'eryndor'], games: 36, rating: 1.7, tier: 2 },
    { id: 'gwyn', name: { en: 'Gwyn/Gunnar', zh: '龙弓／炮魔', ko: '귀네스/군나르' }, heroes: ['gwyneth', 'gunnar'], games: 512, rating: 1.64, tier: 1 },
    { id: 'evie', name: { en: 'Orion/Evie+Perseus', zh: '王子／伊芙 + 人皇', ko: '오리안/이브+페르세우스' }, heroes: ['orion', 'evie'], games: 335, rating: 1.54, tier: 1 },
    { id: 'alna', name: { en: 'Alna/Sylph/Mehira', zh: '冬喉／鸟神／魅魔', ko: '아르나/실피라/메히라' }, heroes: ['sylphira', 'alna', 'mehira'], games: 313, rating: 1.46, tier: 1 },
    { id: 'saida', name: { en: 'Saida/Contess/Twins', zh: '悉达／书魔／双子', ko: '시타/칸티아스/일리아&라이라' }, heroes: ['contess', 'elijah-lailah', 'saida'], games: 317, rating: 1.08, tier: 2 },
    { id: 'zorya', name: { en: 'Zorya/Athalia/Pandora', zh: '石像鬼／天罚／潘多拉', ko: '조르아/아탈리아/판도라' }, heroes: ['zorya', 'athalia', 'pandora'], games: 147, rating: 0.69, tier: 2 },
    { id: 'evie-hepler', name: { en: 'Orion/Evie/Hepler/Koko', zh: '王子／伊芙／枭熊／卡卡', ko: '오리안/이브/헤플러/카이' }, heroes: ['hepler', 'orion', 'koko', 'evie'], games: 15, rating: 0.65, tier: 2 },
    { id: 'dun-pandora', name: { en: 'Dun/Pandora/Cryonaia', zh: '钟神／潘多拉／冰魔', ko: '던릴/판도라/티스니아' }, heroes: ['dunlingr', 'pandora', 'cryonaia'], games: 20, rating: 0.64, tier: 2 },
    { id: 'thador', name: { en: 'Thador/Solise', zh: '都铎／狐狸', ko: '튜더/솔리스' }, heroes: ['thador', 'solise'], games: 247, rating: 0.53, tier: 3 },
  ],
  counters: [
    { winner: 'rolan-twins', loser: 'evie', wins: 12, losses: 4, band: 2, anchor: 'counter-rolan-twins-vs-evie' },
    { winner: 'rolan-twins', loser: 'alna', wins: 5, losses: 1, band: 0, anchor: 'counter-rolan-twins-vs-alna' },
    { winner: 'alna-athalia-eryndor', loser: 'gwyn', wins: 5, losses: 2, band: 0, anchor: 'counter-alna-athalia-eryndor-vs-gwyn' },
    { winner: 'alna-athalia-eryndor', loser: 'alna', wins: 4, losses: 2, band: 2, anchor: 'counter-alna-athalia-eryndor-vs-alna' },
    { winner: 'gwyn', loser: 'rolan-twins', wins: 10, losses: 5, band: 2, anchor: 'counter-gwyn-vs-rolan-twins' },
    { winner: 'gwyn', loser: 'evie', wins: 42, losses: 21, band: 2, anchor: 'counter-gwyn-vs-evie' },
    { winner: 'gwyn', loser: 'saida', wins: 50, losses: 16, band: 2, anchor: 'counter-gwyn-vs-saida' },
    { winner: 'gwyn', loser: 'evie-hepler', wins: 5, losses: 1, band: 3, anchor: 'counter-gwyn-vs-evie-hepler' },
    { winner: 'gwyn', loser: 'dun-pandora', wins: 5, losses: 0, band: 0, anchor: 'counter-gwyn-vs-dun-pandora' },
    { winner: 'gwyn', loser: 'thador', wins: 34, losses: 5, band: 3, anchor: 'counter-gwyn-vs-thador' },
    { winner: 'evie', loser: 'alna', wins: 28, losses: 18, band: 1, anchor: 'counter-evie-vs-alna' },
    { winner: 'evie', loser: 'zorya', wins: 25, losses: 0, band: 3, anchor: 'counter-evie-vs-zorya' },
    { winner: 'evie', loser: 'thador', wins: 20, losses: 7, band: 0, anchor: 'counter-evie-vs-thador' },
    { winner: 'alna', loser: 'gwyn', wins: 49, losses: 26, band: 2, anchor: 'counter-alna-vs-gwyn' },
    { winner: 'saida', loser: 'evie', wins: 32, losses: 17, band: 2, anchor: 'counter-saida-vs-evie' },
    { winner: 'saida', loser: 'zorya', wins: 14, losses: 0, band: 0, anchor: 'counter-saida-vs-zorya' },
    { winner: 'zorya', loser: 'gwyn', wins: 26, losses: 20, band: 1, anchor: 'counter-zorya-vs-gwyn' },
  ],
}
