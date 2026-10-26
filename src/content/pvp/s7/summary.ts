import type { PvpSeasonSummary } from '@/lib/types/pvp'

/* Season 7: the report's team groups, most played first.
 * Generated with the report and copied in beside its template, so an edit
 * made here is lost with the next copy. */
export const S7: PvpSeasonSummary = {
  season: 7,
  languages: ['en', 'zh', 'ko'],
  teams: [
    { name: { en: 'Gwyn/Gunnar', zh: '龙弓／炮魔', ko: '귀네스/군나르' }, heroes: ['gwyneth', 'gunnar'], games: 512 },
    { name: { en: 'Orion/Evie+Perseus', zh: '王子／伊芙 + 人皇', ko: '오리안/이브+페르세우스' }, heroes: ['orion', 'evie'], games: 335 },
    { name: { en: 'Saida/Contess/Twins', zh: '悉达／书魔／双子', ko: '시타/칸티아스/일리아&라이라' }, heroes: ['contess', 'elijah-lailah', 'saida'], games: 317 },
    { name: { en: 'Alna/Sylph/Mehira', zh: '冬喉／鸟神／魅魔', ko: '아르나/실피라/메히라' }, heroes: ['sylphira', 'alna', 'mehira'], games: 313 },
    { name: { en: 'Thador/Solise', zh: '都铎／狐狸', ko: '튜더/솔리스' }, heroes: ['thador', 'solise'], games: 247 },
    { name: { en: 'Zorya/Athalia/Pandora', zh: '石像鬼／天罚／潘多拉', ko: '조르아/아탈리아/판도라' }, heroes: ['zorya', 'athalia', 'pandora'], games: 147 },
    { name: { en: 'Rolan/Twins', zh: '罗兰／双子', ko: '로란 대제/일리아&라이라' }, heroes: ['rolan', 'elijah-lailah'], games: 78 },
    { name: { en: 'Alna/Athalia/Eryndor', zh: '冬喉／天罚／埃德加', ko: '아르나/아탈리아/에린도르' }, heroes: ['alna', 'athalia', 'eryndor'], games: 36 },
    { name: { en: 'Dun/Pandora/Cryonaia', zh: '钟神／潘多拉／冰魔', ko: '던릴/판도라/티스니아' }, heroes: ['dunlingr', 'pandora', 'cryonaia'], games: 20 },
    { name: { en: 'Orion/Evie/Hepler/Koko', zh: '王子／伊芙／枭熊／卡卡', ko: '오리안/이브/헤플러/카이' }, heroes: ['hepler', 'orion', 'koko', 'evie'], games: 15 },
  ],
}
