import type { Post } from 'valaxy'
import { useSiteConfig } from 'valaxy'
import type { PostListItem } from '../types/posts'
import { fuzzySearchPosts } from '../utils/fuzzySearch'
import { normalizePinOrder } from '../utils/pinOrder'
import { searchPostList } from '../utils/postsApi'
import { loadDynamicPosts } from './useDynamicPosts'
import { useAllMergedPosts } from './useMergedPostList'

function toPostListItem(post: Post | PostListItem): PostListItem {
  const slug = (post as PostListItem).slug
    || (post.path?.replace(/^\/posts\//, '').replace(/\/$/, '') ?? '')
  return {
    slug,
    title: post.title || '',
    excerpt: post.excerpt,
    date: String(post.date || ''),
    updated: post.updated ? String(post.updated) : undefined,
    categories: post.categories,
    tags: post.tags,
    cover: post.cover,
    path: post.path || `/posts/${slug}`,
    pin_order: (post as PostListItem).pin_order ?? normalizePinOrder(post.top),
    top: post.top,
    hidden: post.hidden,
    draft: post.draft,
  }
}

export function useFuzzyPostSearch() {
  const siteConfig = useSiteConfig()
  const mergedPosts = useAllMergedPosts()

  async function search(keyword: string, limit = 20): Promise<PostListItem[]> {
    const q = keyword.trim()
    if (!q)
      return []

    // 1) 优先走服务端全文搜索：后端检索 posts_fts 的正文列，
    //    才能搜到文章里罗列的片名/资源名（本地列表接口不含正文）。
    try {
      const { posts } = await searchPostList(q, limit)
      if (posts?.length)
        return posts.map(post => toPostListItem(post))
    }
    catch {
      // 服务端不可用时静默降级到本地模糊匹配
    }

    // 2) 兜底：本地 fuse 模糊匹配（仅覆盖标题/摘要/分类/标签）
    await loadDynamicPosts()
    const posts = mergedPosts.value.map(post => toPostListItem(post))
    const fuseOptions = siteConfig.value.fuse?.options || {}
    return fuzzySearchPosts(posts, q, fuseOptions, limit)
  }

  return { search }
}
