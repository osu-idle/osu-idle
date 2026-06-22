import { GoodGrade } from '@osu-idle/shared/judgement';
import { SkillSort } from '../components/leaderboard/PlayerSkillLeaderboard';
import { rpc, unwrap } from './client';

/** Countries that have at least one player, most populated first. */
export const getCountries = () =>
	unwrap(rpc.v1.ranking.countries.$get());

export const getGlobalRanking = (page: number = 1) =>
	unwrap(rpc.v1.ranking.global[':page'].$get({ param: { page: String(page) } }));

export const getCountryGlobalRanking = (country: string, page: number = 1) =>
	unwrap(rpc.v1.ranking.global.country[':country'][':page'].$get({ param: { country, page: String(page) } }));

export const getScoreRanking = (page: number = 1) =>
	unwrap(rpc.v1.ranking.score[':page'].$get({ param: { page: String(page) } }));

export const getCountryScoreRanking = (country: string, page: number = 1) =>
	unwrap(rpc.v1.ranking.score.country[':country'][':page'].$get({ param: { country, page: String(page) } }));

export const getSkillRanking = (skill: SkillSort, page: number = 1) =>
	unwrap(rpc.v1.ranking.skill[':skill'].page[':page'].$get({ param: { skill, page: String(page) } }));

export const getCountrySkillRanking = (skill: SkillSort, country: string, page: number = 1) =>
	unwrap(rpc.v1.ranking.skill[':skill'].country[':country'].page[':page'].$get({ param: { skill, page: String(page), country } }));

export const getGradesRanking = (grade: GoodGrade | 'all', page: number = 1) =>
	unwrap(rpc.v1.ranking.grades[':grade'].page[':page'].$get({ param: { grade, page: String(page) } }));

export const getCountryGradesRanking = (grade: GoodGrade | 'all', country: string, page: number = 1) =>
	unwrap(rpc.v1.ranking.grades[':grade'].country[':country'].page[':page'].$get({ param: { grade, page: String(page), country } }));