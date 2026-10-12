/** Bilingual portfolio data. Section identifiers preserve the original gallery transitions. */
export interface WorkListItem {
  name: string
  meta?: string
  tags?: string[]
  link?: string
  slug?: string
}

export interface WorkGroup {
  heading: string
  items: string[]
}

export interface WorkSection {
  id: string
  no: string
  title: string
  tagline: string
  items?: WorkListItem[]
  groups?: WorkGroup[]
  awards?: string[]
  footer?: string
}

export interface WorksLang {
  title: string
  closeLabel: string
  openLabel: string
  hint: string
  awardsLabel: string
  visitLabel: string
  detailPlaceholder: string
  phImageLabel: string
  phButtonLabel: string
  countLabel: (n: number) => string
  sections: WorkSection[]
}

export const WORKS: Record<'zh' | 'en', WorksLang> = {
  zh: {
    title: 'Works',
    closeLabel: '返回',
    openLabel: '点击查看',
    hint: '继续下滑',
    awardsLabel: '项目获奖',
    visitLabel: '查看相关内容',
    detailPlaceholder: '每一次认真尝试，都算数。',
    phImageLabel: '创作与生活记录',
    phButtonLabel: '继续探索',
    countLabel: (n) => `${n} 组作品`,
    sections: [
      {
        id: 'ad',
        no: '01',
        title: 'AI 创作',
        tagline: '把想法，做成作品',
        items: [
          { name: '知识星域', meta: 'AI 应用', slug: 'knowledge-star' },
        ],
      },
      {
        id: 'maker',
        no: '02',
        title: '视觉设计',
        tagline: 'FOUR · 逐光而行',
        items: [
          { name: 'FOUR', meta: '班服设计', slug: 'four' },
        ],
      },
      {
        id: 'product',
        no: '03',
        title: '摄影',
        tagline: '镜头向外，认真生活',
        items: [
          { name: '山海之间', meta: '摄影记录', slug: 'photography' },
        ],
      },
      {
        id: 'graphics',
        no: '04',
        title: '生活与舞台',
        tagline: '热爱，不止一面',
        items: [
          { name: '骑行与健身', slug: 'cycling-fitness' },
          { name: '走进聚光灯', meta: '舞台', slug: 'stage' },
        ],
      },
      {
        id: 'cooking',
        no: '05',
        title: '日常有味',
        tagline: '认真做饭，好好生活',
        items: [
          { name: '我的餐桌', meta: '下厨与美食记录', slug: 'home-cooking' },
        ],
      },
    ],
  },
  en: {
    title: 'Works',
    closeLabel: 'Back',
    openLabel: 'View project',
    hint: 'Keep scrolling',
    awardsLabel: 'Project award',
    visitLabel: 'Explore more',
    detailPlaceholder: 'Every honest attempt counts.',
    phImageLabel: 'Work and life',
    phButtonLabel: 'Keep exploring',
    countLabel: (n) => `${n} ${n === 1 ? 'collection' : 'collections'}`,
    sections: [
      {
        id: 'ad',
        no: '01',
        title: 'AI Projects',
        tagline: 'Ideas, made real',
        items: [
          { name: 'Knowledge Star', meta: 'AI application', slug: 'knowledge-star-en' },
        ],
      },
      {
        id: 'maker',
        no: '02',
        title: 'Visual Design',
        tagline: 'FOUR · Toward the light',
        items: [
          { name: 'FOUR', meta: 'Class T-shirt design', slug: 'four-en' },
        ],
      },
      {
        id: 'product',
        no: '03',
        title: 'Photography',
        tagline: 'Looking outward',
        items: [
          { name: 'Between hills and sea', meta: 'Photography', slug: 'photography-en' },
        ],
      },
      {
        id: 'graphics',
        no: '04',
        title: 'Life & Stage',
        tagline: 'More than one way to live',
        items: [
          { name: 'Cycling & fitness', slug: 'cycling-fitness-en' },
          { name: 'Step into the light', meta: 'Stage', slug: 'stage-en' },
        ],
      },
      {
        id: 'cooking',
        no: '05',
        title: 'Everyday Flavours',
        tagline: 'Good food, everyday moments',
        items: [
          { name: 'At my table', meta: 'Cooking & food records', slug: 'home-cooking-en' },
        ],
      },
    ],
  },
}

export const SECTION_COVERS: Record<string, string> = {
  ad: `${import.meta.env.BASE_URL}media/knowledge-star-home.webp`,
  maker: `${import.meta.env.BASE_URL}media/four-uniform-editorial.webp`,
  product: `${import.meta.env.BASE_URL}media/photography/sunset-camera.webp`,
  graphics: `${import.meta.env.BASE_URL}media/cycling/night-ride.webp`,
  cooking: `${import.meta.env.BASE_URL}media/cooking/home-table.jpg`,
}

/** Count the items shown by the original gallery card. */
export function sectionCount(section: WorkSection): number {
  if (section.items) return section.items.length
  if (section.groups) return section.groups.reduce((n, g) => n + g.items.length, 0)
  return 0
}
