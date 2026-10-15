import { useParams } from 'react-router'
import { DocumentEditor } from '@/components/content/document-editor'
import { emptyPost, postFromData, postHasLocale, postToData } from '../api/post-form'
import { PostLocaleFields, PostSidebar } from '../components/post-fields'

/**
 * The API reports the article's fields by their stored blocks ("locales.uz.blocks.text.text",
 * "shared.blocks.1.items"); the form has them as sections.
 */
function fieldOfIssue(path: string): string {
  const parts = path.split('.')
  if (parts[0] === 'locales' && parts[2] === 'blocks') return `locales.${parts[1]}.text`
  if (parts[0] === 'shared' && parts[1] === 'blocks') {
    if (parts.includes('items')) return 'shared.gallery'
    if (parts.includes('url')) return 'shared.videoUrl'
    // "Добавьте текст материала": nothing in the article yet.
    return 'locales.uz.text'
  }
  return (parts[0] === 'locales' ? parts.slice(0, 3) : parts.slice(0, 2)).join('.')
}

export function NewsEditorPage() {
  const { id } = useParams()
  const existing = id && id !== 'new' ? id : undefined
  return (
    <DocumentEditor
      // A different post is a different form: nothing carries over.
      key={existing ?? 'new'}
      type="post"
      id={existing}
      newTitle="Новый материал"
      heading={{ create: 'Новый материал', edit: 'Редактирование материала' }}
      bareLocale
      list={{ path: '/news', label: 'Новости и блог' }}
      permissions={{ write: 'content.write', publish: 'content.publish' }}
      titleName="locales.uz.title"
      empty={emptyPost}
      fromData={postFromData}
      toData={postToData}
      hasLocale={postHasLocale}
      fieldOfIssue={fieldOfIssue}
      renderLocale={(context) => <PostLocaleFields {...context} />}
      renderSidebar={(context) => <PostSidebar {...context} />}
    />
  )
}
