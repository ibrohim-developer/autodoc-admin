import { useParams } from 'react-router'
import { DocumentEditor } from '@/components/content/document-editor'
import { emptyPost, postFromData, postHasLocale, postToData } from '../api/post-form'
import { PostLocaleFields, PostSharedFields, PostSidebar } from '../components/post-fields'

export function NewsEditorPage() {
  const { id } = useParams()
  const existing = id && id !== 'new' ? id : undefined
  return (
    <DocumentEditor
      // A different post is a different form: nothing carries over.
      key={existing ?? 'new'}
      type="post"
      id={existing}
      newTitle="Новая новость"
      list={{ path: '/news', label: 'Новости' }}
      permissions={{ write: 'content.write', publish: 'content.publish' }}
      titleName="locales.uz.title"
      empty={emptyPost}
      fromData={postFromData}
      toData={postToData}
      hasLocale={postHasLocale}
      renderLocale={(context) => <PostLocaleFields {...context} />}
      renderShared={() => <PostSharedFields />}
      renderSidebar={(context) => <PostSidebar {...context} />}
    />
  )
}
