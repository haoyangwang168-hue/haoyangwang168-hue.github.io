export interface WorkBrief { objective: string; contribution: string; outcome: string }

/** Project facts shared by the overview and detail pages. */
export const WORK_BRIEFS: Record<'zh' | 'en', Record<string, WorkBrief>> = {
  zh: {
    'knowledge-star': { objective: '把零散素材整理成可追溯的知识笔记与星图。', contribution: '团队共同构思；独立设计与实现，合作讲解。', outcome: 'LPT 第七期 Demo 视觉美学奖。' },
    four: { objective: '为网络与新媒体四班设计 FOUR 班服。', contribution: '独立设计图形、配色与印花尺寸。', outcome: '从正背面效果图，到班服实物细节。' },
    photography: { objective: '记录山海、光影与日常细节。', contribution: '摄影与旅行记录，按三个主题整理。', outcome: '12 张照片，三个系列。' },
    'home-cooking': { objective: '记录下厨与家常餐桌。', contribution: '日常做饭与美食记录。', outcome: '12 张照片，留住厨房与餐桌上的片刻。' },
    'cycling-fitness': { objective: '留住城市夜骑与训练的片刻。', contribution: '日常骑行与人体旗帜训练记录。', outcome: '骑行影像与训练照片。' },
    stage: { objective: '走进舞台，尝试另一种表达。', contribution: '参与《雷雨》舞台剧与北京路橱窗表演。', outcome: '参演剧照与表演证书。' },
  },
  en: {
    'knowledge-star': { objective: 'Turn scattered material into traceable notes and a knowledge map.', contribution: 'Team concept; independent design and implementation, joint presentation.', outcome: 'LPT Cohort 7 Demo Visual Aesthetics Award.' },
    four: { objective: 'Create the FOUR class T-shirt for Network and New Media Class 4.', contribution: 'Independent graphic, colour and print specification design.', outcome: 'Front and back mockups, with finished T-shirt details.' },
    photography: { objective: 'Record coasts, light and everyday details.', contribution: 'Photography and travel records curated into three themes.', outcome: '12 photographs across three series.' },
    'home-cooking': { objective: 'Keep moments from the kitchen and the everyday table.', contribution: 'Everyday cooking and food records.', outcome: 'Twelve photographs of food, preparation and shared meals.' },
    'cycling-fitness': { objective: 'Keep moments from city night rides and training.', contribution: 'Everyday cycling and human flag training records.', outcome: 'Cycling images and training photographs.' },
    stage: { objective: 'Explore another form of expression on stage.', contribution: 'Performed in Thunderstorm and a Beijing Road window performance.', outcome: 'Performance photographs and a certificate.' },
  },
}

export function getWorkBrief(slug: string | undefined, lang: 'zh' | 'en'): WorkBrief | undefined {
  return slug ? WORK_BRIEFS[lang][slug.replace(/-en$/, '')] : undefined
}
