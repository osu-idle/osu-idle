import { SkillSort } from '../components/leaderboard/PlayerSkillLeaderboard';
import { rpc, unwrap } from './client';

export const getGlobalRanking = (page: number = 1) =>
	unwrap(rpc.v1.ranking.global[':page'].$get({ param: { page: String(page) } }));

export const getScoreRanking = (page: number = 1) =>
	unwrap(rpc.v1.ranking.score[':page'].$get({ param: { page: String(page) } }));

export const getSkillRanking = (skill: SkillSort, page: number = 1) =>
	unwrap(rpc.v1.ranking.skill[':skill'].page[':page'].$get({ param: { skill, page: String(page) } }));

export const getCountrySkillRanking = (skill: SkillSort, country: string, page: number = 1) =>
	unwrap(rpc.v1.ranking.skill[':skill'].country[':country'].page[':page'].$get({ param: { skill, page: String(page), country } }));